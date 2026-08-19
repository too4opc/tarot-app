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
  "hook": "ประโยคเปิด 1 ประโยค สะท้อนแก่นแท้/พลังงานของไพ่ใบนี้ทันที",
  "key1_title": "หัวข้อประเด็นที่ 1 (สั้น กระชับ ไม่เกิน 6 คำ)",
  "key1_desc": "อธิบายประเด็นที่ 1 สั้นๆ 1 ประโยค (ยาวได้ไม่เกิน 2 ประโยคถ้าจำเป็น)",
  "key2_title": "หัวข้อประเด็นที่ 2 (สั้น กระชับ ไม่เกิน 6 คำ)",
  "key2_desc": "อธิบายประเด็นที่ 2 สั้นๆ 1 ประโยค (ยาวได้ไม่เกิน 2 ประโยคถ้าจำเป็น)",
  "do": "สิ่งที่ควรทำ 1 อย่าง เป็นรูปธรรม สั้น กระชับ ไม่เกิน 1 ประโยค",
  "dont": "สิ่งที่ควรหลีกเลี่ยง 1 อย่าง เป็นรูปธรรม สั้น กระชับ ไม่เกิน 1 ประโยค",
  "conclusion": "ประโยคสรุปทรงพลัง 1 ประโยค ให้กำลังใจ ปิดท้ายอย่างอบอุ่น"
}`;

// บุคลิก+โทนเสียงร่วมของทุก prompt: เน้นให้ผูกกับความหมายเฉพาะของไพ่ใบนั้นจริงๆ (กันไม่ให้ AI แต่งคำปลอบใจ
// กลางๆ ที่ใช้สลับกับไพ่ใบไหนก็ได้ ซึ่งเป็นปัญหาที่เจอจริงว่าอ่านแล้วรู้สึกเหมือนกันเกือบทุกใบ)
const PERSONA_STYLE = `บุคลิกของคุณ: นักเล่าเรื่องและนักอ่านไพ่ทาโรต์ฝีมือฉกาจ อ่านไพ่ได้ลึกซึ้งราวกับมองทะลุเข้าไปในใจผู้ถาม แต่เล่าออกมาให้เข้าใจง่ายจนเด็กประถมก็ฟังรู้เรื่อง

กฎการเขียนที่สำคัญที่สุด (ต้องทำตามเคร่งครัดทุกข้อ):
- ทุกประโยคต้องอิงความหมายเฉพาะของไพ่ใบนั้น (ที่ให้มาในบริบท) เป็นแกนหลัก ใช้สัญลักษณ์ อารมณ์ และเรื่องราวที่ไพ่ใบนี้สื่อจริงๆ มาถักทอเป็นคำทำนาย ห้ามเขียนคำปลอบใจกลางๆ ที่เอาไปสลับใช้กับไพ่ใบไหนก็ได้เหมือนกันหมด
- อ่านแล้วต้องรู้สึกว่า "นี่คือไพ่ใบนี้จริงๆ" มีกลิ่นอายเฉพาะตัวชัดเจน แตกต่างจากไพ่ใบอื่นในกองเดียวกันอย่างเห็นได้ชัด
- ห้ามใช้วลีคลิเช่ซ้ำซาก เช่น "ไม่เป็นไรเลยที่จะรู้สึกแบบนี้", "ให้เวลาตัวเอง", "โอบกอดความรู้สึก", "อนุญาตให้ตัวเองรู้สึก" หรือภาษาแนวจิตวิทยาบำบัดที่ฟังดูเป็นแพทเทิร์นซ้ำๆ — ใช้ภาษาธรรมชาติ มีชีวิตชีวา เหมือนคนเล่าเรื่องจริงๆ ไม่ใช่ท่องบทตายตัว
- ความยาวกำลังดี: ไม่สั้นห้วนจนขาดใจความ ไม่ยาวเยิ่นเย้อจนจับประเด็นไม่ทัน แต่ละประโยคต้องสื่อความชัดเจนมีน้ำหนัก
- ภาษาเรียบง่าย เข้าใจง่าย แต่ลึกซึ้งกินใจ หลีกเลี่ยงศัพท์วิชาการหรือภาษาทางการที่ฟังดูแปลกๆ ไม่เป็นธรรมชาติ`;

const FRAMEWORK_RULES = `${PERSONA_STYLE}

โครงสร้างการเขียนคำทำนาย (สำคัญมาก! ต้องมีครบ 4 ส่วนตามลำดับนี้เท่านั้น ห้ามขาด ห้ามสลับ):
1. Hook: ประโยคแรกดึงความสนใจ สะท้อนแก่นแท้และพลังงานเฉพาะตัวของไพ่ใบนี้ทันที (ไม่ใช่ประโยคเปิดกลางๆ ที่ใช้กับไพ่ใบไหนก็ได้)
2. Keys: ประเด็นสำคัญ 2 ประเด็นที่ไพ่ใบนี้โดยเฉพาะกำลังสื่อ (key1_title/key1_desc และ key2_title/key2_desc) แต่ละประเด็นมีหัวข้อสั้นๆ และคำอธิบาย 1-2 ประโยคที่อธิบายความหมายไพ่อย่างลึกซึ้งแต่เข้าใจง่าย
3. Do & Don't: สิ่งที่ควรทำ 1 อย่าง (do) และสิ่งที่ควรหลีกเลี่ยง 1 อย่าง (dont) ที่เป็นรูปธรรม เชื่อมโยงกับบทเรียนของไพ่ใบนี้ นำไปปรับใช้ได้จริงทันที
4. Conclusion: ประโยคสรุปทรงพลัง ให้กำลังใจ ปิดท้ายอย่างอบอุ่น สอดคล้องกับพลังงานของไพ่ใบนี้
กฎสำคัญ: แม้ไพ่จะเลวร้ายแค่ไหน ห้ามขู่ให้กลัว ให้ตีความเป็น "บทเรียนเพื่อเติบโต" มอบพลังบวกเสมอ
ห้าม: เอ่ยชื่อไพ่ | ทำนายตาย/โรคภัย/ลงทุน | ใช้คำว่า "ดวงตก" หรือ "เคราะห์ร้าย"`;

// การทำนาย 10 ใบให้เนื้อหาเยอะ (framework 4 ส่วน x10) ทำให้โมเดลตอบช้าจนชน execution timeout ของ
// Netlify Function (504) และเสี่ยงตอบ JSON ไม่จบ (502) -> แบ่งเป็น 3 คำขอขนานกัน: readings ใบ 1-5,
// readings ใบ 6-10, และ summary+mutelu แยกเป็นก้อนเล็กของตัวเอง (ไม่พ่วงกับ readings ที่หนักอยู่แล้ว
// เพื่อไม่ให้ summary/mutelu หายไปด้วยตอนที่ readings ถูกตัดกลางคัน)
const SYSTEM_10_A = `คุณจะได้รับไพ่ทั้ง 10 ใบเป็นบริบท แต่ให้เขียนคำทำนายเฉพาะใบที่ 1-5 เท่านั้น (ไพ่ใบที่ 6-10 ใช้แค่ประกอบบริบท)

${FRAMEWORK_RULES}

ตอบเป็น JSON เท่านั้นตามโครงสร้างนี้ (readings ต้องมี 5 ชิ้น ตรงกับไพ่ใบที่ 1-5 ตามลำดับ แต่ละชิ้นมีรูปแบบ: ${READING_SHAPE_DOC}):
{
  "readings": [ /* รายการ 5 ชิ้น สำหรับไพ่ใบที่ 1-5 */ ]
}`;

const SYSTEM_10_B = `คุณจะได้รับไพ่ทั้ง 10 ใบเป็นบริบท แต่ให้เขียนคำทำนายเฉพาะใบที่ 6-10 เท่านั้น (ไพ่ใบที่ 1-5 ใช้แค่ประกอบบริบท)

${FRAMEWORK_RULES}

ตอบเป็น JSON เท่านั้นตามโครงสร้างนี้ (readings ต้องมี 5 ชิ้น ตรงกับไพ่ใบที่ 6-10 ตามลำดับ แต่ละชิ้นมีรูปแบบ: ${READING_SHAPE_DOC}):
{
  "readings": [ /* รายการ 5 ชิ้น สำหรับไพ่ใบที่ 6-10 */ ]
}`;

const SYSTEM_10_SUMMARY = `${PERSONA_STYLE}

คุณจะได้รับไพ่ทั้ง 10 ใบเป็นบริบท ให้เขียนบทสรุปรวมของทั้ง 10 ใบเป็นเรื่องราวเดียวที่ร้อยเรียงกัน (ไม่ต้องแยกทำนายรายใบ) เชื่อมโยงให้เห็นว่าไพ่ทั้งชุดกำลังเล่าเรื่องอะไรให้ผู้ถามฟัง
กฎสำคัญ: แม้ไพ่จะเลวร้ายแค่ไหน ห้ามขู่ให้กลัว ให้ตีความเป็น "บทเรียนเพื่อเติบโต" มอบพลังบวกเสมอ
ห้าม: เอ่ยชื่อไพ่ | ทำนายตาย/โรคภัย/ลงทุน | ใช้คำว่า "ดวงตก" หรือ "เคราะห์ร้าย"

ตอบเป็น JSON เท่านั้นตามโครงสร้างนี้:
{
  "summary": "สรุปใจความสำคัญของทั้ง 10 ใบและให้กำลังใจอย่างลึกซึ้ง ความยาว 5-6 ประโยค ห้ามเกิน 6 ประโยค",
  "mutelu": {"make_merit":"...","lucky_item":"...","lucky_number":"..."}
}`;

const SYSTEM_3_TEMPLATE = `ตอบคำถามเจาะจงจากไพ่ 3 ใบ (ใช้ตรรกะเสียงข้างมากของไพ่ทั้ง 3 ใบ)
{{BASE_SUMMARY}}

${FRAMEWORK_RULES}

ตอบเป็น JSON เท่านั้นตามโครงสร้างนี้:
{
  "answer": ${READING_SHAPE_DOC},
  "mutelu": {"make_merit":"...","lucky_item":"...","lucky_number":"..."}
}`;

const SYSTEM_DREAM_TEMPLATE = `หน้าที่พิเศษของคุณรอบนี้: ตีความความฝัน เลือกไพ่ทาโรต์ 3 ใบที่สื่อถึงฝันนั้นมากที่สุดจากรายการไพ่ และให้คำแนะนำ
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
    } catch {
      // ความผิดพลาดที่พบบ่อยที่สุดจากโมเดล: ปิด } ของ object หนึ่งใน array แล้วเปิด { ของตัวถัดไปทันที
      // โดยลืมใส่คอมม่าคั่น -> ซ่อมด้วยการแทรกคอมม่าเข้าไปแล้วลอง parse ใหม่อีกครั้งก่อนจะยอมแพ้
      const repaired = m[0].replace(/\}(\s*)\{/g, '},$1{');
      try {
        return JSON.parse(repaired);
      } catch (finalErr) {
        // DEBUG: ดัมพ์ context กว้างขึ้นมากเพื่อดูโครงสร้างจริงที่โมเดลตอบมา (ชั่วคราว ไว้วินิจฉัยจุดพัง)
        const posMatch = finalErr.message.match(/position (\d+)/);
        const pos = posMatch ? parseInt(posMatch[1], 10) : null;
        const context = pos != null ? repaired.slice(Math.max(0, pos - 400), pos + 400) : repaired.slice(0, 800);
        throw new Error(`${finalErr.message} | context: ...${context}...`);
      }
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

      // ส่งบริบทไพ่ครบ 10 ใบให้ทุกฝั่ง (เพื่อให้ summary/โทนเรื่องราวสอดคล้องกัน) แต่แยกงานเป็น 3 ก้อนเล็ก
      // ยิงขนานกันด้วย Promise.all: readings 1-5, readings 6-10, และ summary+mutelu แยกต่างหาก
      // -> แต่ละก้อนตอบเร็วและมีโอกาสถูกตัดจบก่อนจบ JSON น้อยลงมาก เทียบกับยัดทุกอย่างไว้ก้อนเดียว
      const fullContext = cards.map((c, i) => `${i + 1}.${c.position}:${c.meaning}`).join("|");
      const userPrompt = `ไพ่ทั้ง 10 ใบ (เรียงตามลำดับ):\n${fullContext}`;

      const [resultA, resultB, resultC] = await Promise.all([
        callOpenRouter(SYSTEM_10_A, userPrompt, 4000),
        callOpenRouter(SYSTEM_10_B, userPrompt, 4000),
        callOpenRouter(SYSTEM_10_SUMMARY, userPrompt, 2000),
      ]);

      if (!Array.isArray(resultA?.readings) || resultA.readings.length !== 5 ||
          !resultA.readings.every(isValidReadingItem)) {
        throw new Error("Bad structure from model (reading10 part A)");
      }
      if (!Array.isArray(resultB?.readings) || resultB.readings.length !== 5 ||
          !resultB.readings.every(isValidReadingItem)) {
        throw new Error("Bad structure from model (reading10 part B)");
      }
      if (typeof resultC?.summary !== "string" || !resultC.mutelu) {
        throw new Error("Bad structure from model (reading10 summary)");
      }

      result = {
        readings: [...resultA.readings, ...resultB.readings],
        summary: resultC.summary,
        mutelu: resultC.mutelu,
      };
    } else if (type === "reading3") {
      const { topic, question, cardMeanings, baseSummary } = body;
      if (!Array.isArray(cardMeanings) || cardMeanings.length !== 3) throw new Error("Invalid cardMeanings payload");
      const sys = SYSTEM_3_TEMPLATE.replace(
        "{{BASE_SUMMARY}}",
        baseSummary ? `[ปูมหลังสภาพจิตใจผู้ถาม: ${String(baseSummary).slice(0, 150)}...]` : ""
      );
      const userPrompt = `หมวด:${topic}|คำถาม:${question || "ภาพรวม"}|ไพ่:${cardMeanings.join("/")}`;
      result = await callOpenRouter(sys, userPrompt, 2400);
      if (!isValidReadingItem(result?.answer) || !result.mutelu) {
        throw new Error("Bad structure from model (reading3)");
      }
    } else if (type === "dream") {
      const { dream } = body;
      if (!dream || typeof dream !== "string") throw new Error("Invalid dream payload");
      const sys = SYSTEM_DREAM_TEMPLATE.replace("{{DECK_INFO}}", DECK_INFO);
      const userPrompt = `ความฝันของฉันคือ: "${dream}"`;
      result = await callOpenRouter(sys, userPrompt, 2400);
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
