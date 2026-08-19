// Netlify Function: proxy คำขอ AI ของแอปดูดวงทาโรต์ไปที่ OpenRouter (model: openrouter/auto)
// - OPENROUTER_API_KEY อ่านจาก process.env เท่านั้น -> ตั้งค่าใน Netlify dashboard/CLI ห้ามฝังในโค้ด/commit
// - เก็บ system prompt + รายชื่อไพ่ทั้ง 78 ใบไว้ฝั่งนี้ (client ส่งแค่ข้อมูลดิบ)
// - Framework การอ่านไพ่: Hook -> Keys(พร้อมคำอธิบาย) -> Do & Don't -> Conclusion
// - Rate limit ต่อ IP ผ่าน Netlify Blobs (ทำงานอัตโนมัติเมื่อ deploy บน Netlify)

const { getStore } = require("@netlify/blobs");

const MODEL = "openrouter/auto";
const MAX_REQUESTS_PER_WINDOW = 20; // ต่อ IP ต่อหน้าต่างเวลา
const WINDOW_MS = 60 * 60 * 1000; // 1 ชั่วโมง

const TAROT_NAMES = [
  "The Fool","The Magician","The High Priestess","The Empress","The Emperor","The Hierophant","The Lovers",
  "The Chariot","Strength","The Hermit","Wheel of Fortune","Justice","The Hanged Man","Death","Temperance",
  "The Devil","The Tower","The Star","The Moon","The Sun","Judgement","The World",
  "Ace of Wands","Two of Wands","Three of Wands","Four of Wands","Five of Wands","Six of Wands","Seven of Wands",
  "Eight of Wands","Nine of Wands","Ten of Wands","Page of Wands","Knight of Wands","Queen of Wands","King of Wands",
  "Ace of Cups","Two of Cups","Three of Cups","Four of Cups","Five of Cups","Six of Cups","Seven of Cups",
  "Eight of Cups","Nine of Cups","Ten of Cups","Page of Cups","Knight of Cups","Queen of Cups","King of Cups",
  "Ace of Swords","Two of Swords","Three of Swords","Four of Swords","Five of Swords","Six of Swords","Seven of Swords",
  "Eight of Swords","Nine of Swords","Ten of Swords","Page of Swords","Knight of Swords","Queen of Swords","King of Swords",
  "Ace of Pentacles","Two of Pentacles","Three of Pentacles","Four of Pentacles","Five of Pentacles","Six of Pentacles",
  "Seven of Pentacles","Eight of Pentacles","Nine of Pentacles","Ten of Pentacles","Page of Pentacles",
  "Knight of Pentacles","Queen of Pentacles","King of Pentacles"
];
const DECK_INFO = TAROT_NAMES.map((n, i) => `${i}:${n}`).join(", ");

// เลี่ยงโครงสร้างซ้อน array-of-objects (เช่น "keys":[{...},{...}]) เพราะโมเดลบางตัวที่ openrouter/auto
// สุ่มไปเจอ มักพิมพ์ผิดคอมม่า/วงเล็บตรงจุดนี้ ทำให้ JSON parse ไม่ผ่าน -> ใช้ field แบนแทนทั้งหมด
const READING_SHAPE_DOC = `{
  "hook": "ประโยคเปิดที่สะท้อนอารมณ์/พลังงานหลักทันที",
  "key1_title": "หัวข้อประเด็นที่ 1 (สั้น กระชับ)",
  "key1_desc": "อธิบายประเด็นที่ 1 ใน 1-2 ประโยค",
  "key2_title": "หัวข้อประเด็นที่ 2 (สั้น กระชับ)",
  "key2_desc": "อธิบายประเด็นที่ 2 ใน 1-2 ประโยค",
  "do": "สิ่งที่ควรทำ 1 อย่าง เป็นรูปธรรม นำไปใช้ได้จริงทันที",
  "dont": "สิ่งที่ควรหลีกเลี่ยง 1 อย่าง เป็นรูปธรรม",
  "conclusion": "ประโยคสรุปทรงพลัง ให้กำลังใจ ปิดท้ายอย่างอบอุ่น"
}`;

const FRAMEWORK_RULES = `โครงสร้างการเขียนคำทำนาย (สำคัญมาก! ต้องมีครบ 4 ส่วนตามลำดับนี้เท่านั้น ห้ามขาด ห้ามสลับ):
1. Hook: ประโยคแรกดึงความสนใจ สะท้อนความรู้สึกหรือพลังงานหลักทันที (เช่น "ดูเหมือนว่า...", "ลึกๆ แล้วคุณอาจกำลัง...")
2. Keys: ประเด็นสำคัญ 2 ประเด็นที่ไพ่กำลังสื่อ (key1_title/key1_desc และ key2_title/key2_desc) แต่ละประเด็นมีหัวข้อสั้นๆ และคำอธิบาย 1-2 ประโยค
3. Do & Don't: สิ่งที่ควรทำ 1 อย่าง (do) และสิ่งที่ควรหลีกเลี่ยง 1 อย่าง (dont) ที่เป็นรูปธรรม นำไปปรับใช้ได้จริงทันที
4. Conclusion: ประโยคสรุปทรงพลัง ให้กำลังใจ ปิดท้ายอย่างอบอุ่น
กฎสำคัญ: แม้ไพ่จะเลวร้ายแค่ไหน ห้ามขู่ให้กลัว ให้ตีความเป็น "บทเรียนเพื่อเติบโต" มอบพลังบวกเสมอ
ห้าม: เอ่ยชื่อไพ่ | ทำนายตาย/โรคภัย/ลงทุน | ใช้คำว่า "ดวงตก" หรือ "เคราะห์ร้าย"`;

// การทำนาย 10 ใบให้เนื้อหาเยอะ (framework 4 ส่วน x10) ทำให้โมเดลตอบช้าจนชน execution timeout
// ของ Netlify Function (504) ได้ง่าย -> แบ่งเป็น 2 คำขอขนานกัน (ใบ 1-5 และ 6-10) แทนการยิงทีเดียว 10 ใบ
// ฝั่ง A รับหน้าที่ทำ summary+mutelu เพิ่มด้วย (ทั้งคู่เห็นบริบทไพ่ครบ 10 ใบเหมือนกัน เพื่อให้สรุปเรื่องราวสอดคล้องกัน)
const SYSTEM_10_A = `คุณคือ "นักจิตบำบัดและที่ปรึกษาชีวิต" (Psychotherapist & Life Counselor) ที่ใช้ไพ่ทาโรต์เป็นเครื่องมือสะท้อนจิตใจผู้คน
สไตล์: ภาษาไทยที่อบอุ่น อ่อนโยน เข้าอกเข้าใจ (Empathetic) ให้ความรู้สึกปลอดภัย ไม่ตัดสิน
คุณจะได้รับไพ่ทั้ง 10 ใบเป็นบริบท แต่ให้เขียนคำทำนายเฉพาะใบที่ 1-5 เท่านั้น (ไพ่ใบที่ 6-10 ใช้แค่ประกอบบริบทสำหรับ summary)

${FRAMEWORK_RULES}

ตอบเป็น JSON เท่านั้นตามโครงสร้างนี้ (readings ต้องมี 5 ชิ้น ตรงกับไพ่ใบที่ 1-5 ตามลำดับ แต่ละชิ้นมีรูปแบบ: ${READING_SHAPE_DOC}):
{
  "readings": [ /* รายการ 5 ชิ้น สำหรับไพ่ใบที่ 1-5 */ ],
  "summary": "5ประโยคที่สรุปใจความสำคัญของทั้ง 10 ใบ (ครบทุกใบ) และให้กำลังใจอย่างลึกซึ้ง",
  "mutelu": {"make_merit":"...","lucky_item":"...","lucky_number":"..."}
}`;

const SYSTEM_10_B = `คุณคือ "นักจิตบำบัดและที่ปรึกษาชีวิต" (Psychotherapist & Life Counselor) ที่ใช้ไพ่ทาโรต์เป็นเครื่องมือสะท้อนจิตใจผู้คน
สไตล์: ภาษาไทยที่อบอุ่น อ่อนโยน เข้าอกเข้าใจ (Empathetic) ให้ความรู้สึกปลอดภัย ไม่ตัดสิน
คุณจะได้รับไพ่ทั้ง 10 ใบเป็นบริบท แต่ให้เขียนคำทำนายเฉพาะใบที่ 6-10 เท่านั้น (ไพ่ใบที่ 1-5 ใช้แค่ประกอบบริบท)

${FRAMEWORK_RULES}

ตอบเป็น JSON เท่านั้นตามโครงสร้างนี้ (readings ต้องมี 5 ชิ้น ตรงกับไพ่ใบที่ 6-10 ตามลำดับ แต่ละชิ้นมีรูปแบบ: ${READING_SHAPE_DOC}):
{
  "readings": [ /* รายการ 5 ชิ้น สำหรับไพ่ใบที่ 6-10 */ ]
}`;

const SYSTEM_3_TEMPLATE = `คุณคือ "นักจิตบำบัดและที่ปรึกษาชีวิต" ตอบคำถามเจาะจงจากไพ่ 3 ใบ (ใช้ตรรกะเสียงข้างมาก)
{{BASE_SUMMARY}}
สไตล์: ตรงประเด็นแต่อบอุ่น ให้ความรู้สึกปลอดภัย เป็นผู้รับฟังที่ดี

${FRAMEWORK_RULES}

ตอบเป็น JSON เท่านั้นตามโครงสร้างนี้:
{
  "answer": ${READING_SHAPE_DOC},
  "mutelu": {"make_merit":"...","lucky_item":"...","lucky_number":"..."}
}`;

const SYSTEM_DREAM_TEMPLATE = `คุณคือ "นักจิตวิเคราะห์ความฝันและที่ปรึกษาชีวิต" (Dream Analyst & Life Counselor) ที่ใช้สัญลักษณ์ไพ่ทาโรต์ในการถอดรหัสจิตใต้สำนึก
หน้าที่: ตีความความฝัน เลือกไพ่ทาโรต์ 3 ใบที่สื่อถึงฝันนั้นมากที่สุดจากรายการไพ่ และให้คำแนะนำ
การตีความ: เชื่อมโยงสัญลักษณ์ในฝันกับความหมายของไพ่ (เช่น ฝันเห็นน้ำ = ถ้วย/อารมณ์)

${FRAMEWORK_RULES}

ตอบเป็น JSON เท่านั้นตามโครงสร้างนี้:
{
  "cardIds": [เลขIDไพ่ใบที่1, เลขIDไพ่ใบที่2, เลขIDไพ่ใบที่3],
  "answer": ${READING_SHAPE_DOC},
  "mutelu": {"make_merit":"...","lucky_item":"...","lucky_number":"..."}
}
รายการไพ่ที่อนุญาตให้อ้างอิง ID (0-77): {{DECK_INFO}}`;

function extractJSON(text = "") {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (firstErr) {
    const m = trimmed.match(/\{[\s\S]*\}/);
    if (!m) throw new Error(`No JSON in model response. Raw (first 300 chars): ${trimmed.slice(0, 300)}`);
    try {
      return JSON.parse(m[0]);
    } catch (secondErr) {
      // แนบ context รอบตำแหน่งที่ parse พังไว้ในข้อความ error เพื่อช่วยดีบักว่าโมเดลพิมพ์อะไรผิด
      const posMatch = secondErr.message.match(/position (\d+)/);
      const pos = posMatch ? parseInt(posMatch[1], 10) : null;
      const context = pos != null ? m[0].slice(Math.max(0, pos - 80), pos + 80) : m[0].slice(0, 200);
      throw new Error(`${secondErr.message} | context: ...${context}...`);
    }
  }
}

function isValidReadingItem(r) {
  return r && typeof r.hook === "string" &&
    typeof r.key1_title === "string" && typeof r.key1_desc === "string" &&
    typeof r.key2_title === "string" && typeof r.key2_desc === "string" &&
    typeof r.do === "string" && typeof r.dont === "string" && typeof r.conclusion === "string";
}

async function checkRateLimit(ip) {
  try {
    const store = getStore("rate-limits");
    const key = `rl_${ip}`;
    const now = Date.now();
    const raw = await store.get(key, { type: "json" });

    let windowStart = now;
    let count = 0;
    if (raw && now - raw.windowStart < WINDOW_MS) {
      windowStart = raw.windowStart;
      count = raw.count;
    }
    if (count >= MAX_REQUESTS_PER_WINDOW) return false;

    await store.setJSON(key, { windowStart, count: count + 1 });
    return true;
  } catch (err) {
    console.warn("[rate-limit] skipped:", err.message);
    return true;
  }
}

async function callOpenRouter(systemPrompt, userPrompt, maxTokens) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.ALLOWED_ORIGIN || "https://tarot-app.netlify.app",
      "X-Title": "Too AI Tarot",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenRouter");
  return extractJSON(content);
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const ip = event.headers["x-nf-client-connection-ip"] || event.headers["client-ip"] || "unknown";
  const allowed = await checkRateLimit(ip);
  if (!allowed) {
    return {
      statusCode: 429,
      body: JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  try {
    const { type } = body;
    let result;

    if (type === "reading10") {
      const cards = body.cards;
      if (!Array.isArray(cards) || cards.length !== 10) throw new Error("Invalid cards payload");

      // ส่งบริบทไพ่ครบ 10 ใบให้ทั้งสองฝั่ง (เพื่อให้ summary/โทนเรื่องราวสอดคล้องกัน)
      // แต่ให้แต่ละฝั่งเขียนคำทำนายแค่ครึ่งเดียว -> ตอบเร็วขึ้นเกือบครึ่ง ยิงขนานกันด้วย Promise.all
      const fullContext = cards.map((c, i) => `${i + 1}.${c.position}:${c.meaning}`).join("|");
      const userPromptA = `ไพ่ทั้ง 10 ใบ (เรียงตามลำดับ):\n${fullContext}`;
      const userPromptB = userPromptA;

      // openrouter/auto บางครั้งสุ่มไปเจอโมเดลที่ใช้ token ส่วนหนึ่งไปกับ "reasoning" ภายในก่อนเขียนคำตอบจริง
      // -> ให้ max_tokens มีระยะกันชนมากพอ ไม่งั้น JSON จะถูกตัดครึ่งกลางคันหรือได้ content ว่างเปล่า
      const [resultA, resultB] = await Promise.all([
        callOpenRouter(SYSTEM_10_A, userPromptA, 3000),
        callOpenRouter(SYSTEM_10_B, userPromptB, 2200),
      ]);

      if (!Array.isArray(resultA?.readings) || resultA.readings.length !== 5 ||
          !resultA.readings.every(isValidReadingItem) ||
          typeof resultA.summary !== "string" || !resultA.mutelu) {
        throw new Error("Bad structure from model (reading10 part A)");
      }
      if (!Array.isArray(resultB?.readings) || resultB.readings.length !== 5 ||
          !resultB.readings.every(isValidReadingItem)) {
        throw new Error("Bad structure from model (reading10 part B)");
      }

      result = {
        readings: [...resultA.readings, ...resultB.readings],
        summary: resultA.summary,
        mutelu: resultA.mutelu,
      };
    } else if (type === "reading3") {
      const { topic, question, cardMeanings, baseSummary } = body;
      if (!Array.isArray(cardMeanings) || cardMeanings.length !== 3) throw new Error("Invalid cardMeanings payload");
      const sys = SYSTEM_3_TEMPLATE.replace(
        "{{BASE_SUMMARY}}",
        baseSummary ? `[ปูมหลังสภาพจิตใจผู้ถาม: ${String(baseSummary).slice(0, 150)}...]` : ""
      );
      const userPrompt = `หมวด:${topic}|คำถาม:${question || "ภาพรวม"}|ไพ่:${cardMeanings.join("/")}`;
      result = await callOpenRouter(sys, userPrompt, 1800);
      if (!isValidReadingItem(result?.answer) || !result.mutelu) {
        throw new Error("Bad structure from model (reading3)");
      }
    } else if (type === "dream") {
      const { dream } = body;
      if (!dream || typeof dream !== "string") throw new Error("Invalid dream payload");
      const sys = SYSTEM_DREAM_TEMPLATE.replace("{{DECK_INFO}}", DECK_INFO);
      const userPrompt = `ความฝันของฉันคือ: "${dream}"`;
      result = await callOpenRouter(sys, userPrompt, 1800);
      if (!Array.isArray(result?.cardIds) || result.cardIds.length !== 3 ||
          !isValidReadingItem(result?.answer) || !result.mutelu) {
        throw new Error("Bad structure from model (dream)");
      }
    } else {
      return { statusCode: 400, body: JSON.stringify({ error: "Unknown type" }) };
    }

    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(result) };
  } catch (err) {
    return { statusCode: 502, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: err.message }) };
  }
};
