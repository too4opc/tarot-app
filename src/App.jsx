import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, ArrowRight, Eye, Loader2, Star, AlertCircle, MessageCircleQuestion, Heart, Moon, Sun } from 'lucide-react';

// เรียกผ่าน Netlify Function (netlify/functions/tarot-ai.js) แทนการยิง Gemini/OpenRouter ตรงจาก browser
// path สัมพัทธ์ -> same-origin กับ netlify.toml ที่ redirect /api/* -> /.netlify/functions/:splat
const PROXY_URL = "/api/tarot-ai";

// ---------------------------------------------------------------------------
// Static Data: Full 78 Cards Tarot Deck
// ---------------------------------------------------------------------------
const TAROT_DECK = [
  { id: 0, name: "The Fool", th: "เดอะฟูล", img: "https://sacred-texts.com/tarot/pkt/img/ar00.jpg", meaning: "การเริ่มต้นใหม่, ความเป็นอิสระ, การเดินทางผจญภัย, ความไร้เดียงสา, การก้าวเดินโดยไร้ข้อผูกมัด" },
  { id: 1, name: "The Magician", th: "เดอะเมจิกเชียน", img: "https://sacred-texts.com/tarot/pkt/img/ar01.jpg", meaning: "พรสวรรค์, การสื่อสาร, การเริ่มต้นที่มีศักยภาพ, การดึงศักยภาพมาใช้, ความเชี่ยวชาญในการจัดการ" },
  { id: 2, name: "The High Priestess", th: "เดอะไฮพรีสเทส", img: "https://sacred-texts.com/tarot/pkt/img/ar02.jpg", meaning: "สัญชาตญาณ, ความลึกลับ, ความรู้ที่ซ่อนเร้น, การรอคอยจังหวะเวลา, สัมผัสที่หก" },
  { id: 3, name: "The Empress", th: "ดิเอ็มเพรส", img: "https://sacred-texts.com/tarot/pkt/img/ar03.jpg", meaning: "ความอุดมสมบูรณ์, ความรัก, ความเป็นแม่, การเจริญเติบโต, ความอิ่มเอมใจ" },
  { id: 4, name: "The Emperor", th: "ดิเอ็มเพอร์เรอร์", img: "https://sacred-texts.com/tarot/pkt/img/ar04.jpg", meaning: "อำนาจ, ความมั่นคง, ความเป็นผู้นำ, กฎระเบียบ, ความสำเร็จที่เกิดจากการควบคุมและมีวินัย" },
  { id: 5, name: "The Hierophant", th: "เดอะไฮโรแฟนท์", img: "https://sacred-texts.com/tarot/pkt/img/ar05.jpg", meaning: "ความศรัทธา, ประเพณี, การศึกษา, สิ่งศักดิ์สิทธิ์คุ้มครอง, การทำตามแบบแผนที่ดีงาม" },
  { id: 6, name: "The Lovers", th: "เดอะเลิฟเวอร์ส", img: "https://sacred-texts.com/tarot/pkt/img/ar06.jpg", meaning: "ความรัก, ทางเลือก, ความสัมพันธ์, การตัดสินใจครั้งสำคัญด้วยหัวใจและความรู้สึก" },
  { id: 7, name: "The Chariot", th: "เดอะชาริออท", img: "https://sacred-texts.com/tarot/pkt/img/ar07.jpg", meaning: "ความมุ่งมั่น, การควบคุม, ชัยชนะเหนืออุปสรรค, การพุ่งชนเป้าหมายโดยไม่ย่อท้อ" },
  { id: 8, name: "Strength", th: "สเตรนจ์", img: "https://sacred-texts.com/tarot/pkt/img/ar08.jpg", meaning: "ความเข้มแข็งภายใน, ความเมตตา, ความอดทน, การเอาชนะปัญหาด้วยความนุ่มนวลและปัญญา" },
  { id: 9, name: "The Hermit", th: "เดอะเฮอร์มิท", img: "https://sacred-texts.com/tarot/pkt/img/ar09.jpg", meaning: "การทบทวนตัวเอง, ความสันโดษ, ปัญญา, การปลีกวิเวกเพื่อค้นหาคำตอบจากภายในจิตใจ" },
  { id: 10, name: "Wheel of Fortune", th: "วีลออฟฟอร์จูน", img: "https://sacred-texts.com/tarot/pkt/img/ar10.jpg", meaning: "โชคชะตา, การเปลี่ยนแปลง, จุดเปลี่ยน, โอกาสใหม่ๆ ที่กำลังหมุนเข้ามาแบบไม่ทันตั้งตัว" },
  { id: 11, name: "Justice", th: "จัสทิส", img: "https://sacred-texts.com/tarot/pkt/img/ar11.jpg", meaning: "ความยุติธรรม, ความสมดุล, กฎแห่งกรรม, การตัดสินใจอย่างมีเหตุผลและเที่ยงธรรม" },
  { id: 12, name: "The Hanged Man", th: "เดอะแฮงก์แมน", img: "https://sacred-texts.com/tarot/pkt/img/ar12.jpg", meaning: "การเสียสละ, การมองในมุมใหม่, การหยุดชะงักเพื่อทบทวน, ความชะงักงันที่แลกมาด้วยปัญญา" },
  { id: 13, name: "Death", th: "เดธ", img: "https://sacred-texts.com/tarot/pkt/img/ar13.jpg", meaning: "การสิ้นสุดเพื่อเริ่มต้นใหม่, การเปลี่ยนแปลงครั้งใหญ่, การตัดจบสิ่งเดิมๆ เพื่อก้าวไปสู่สิ่งใหม่" },
  { id: 14, name: "Temperance", th: "เทมเพอแรนซ์", img: "https://sacred-texts.com/tarot/pkt/img/ar14.jpg", meaning: "ความสมดุล, การประนีประนอม, การเยียวยา, การผสมผสานและปรับตัวให้เข้ากับสถานการณ์" },
  { id: 15, name: "The Devil", th: "เดอะเดวิล", img: "https://sacred-texts.com/tarot/pkt/img/ar15.jpg", meaning: "กิเลส, ความผูกมัด, ข้อจำกัด, ความลุ่มหลง, สถานการณ์ที่กลืนไม่เข้าคายไม่ออกหรือถูกล่อลวง" },
  { id: 16, name: "The Tower", th: "เดอะทาวเวอร์", img: "https://sacred-texts.com/tarot/pkt/img/ar16.jpg", meaning: "การพังทลาย, การเปลี่ยนแปลงกะทันหัน, เหตุการณ์ที่ไม่คาดฝันที่สั่นคลอนรากฐานเดิม" },
  { id: 17, name: "The Star", th: "เดอะสตาร์", img: "https://sacred-texts.com/tarot/pkt/img/ar17.jpg", meaning: "ความหวัง, แรงบันดาลใจ, การฟื้นฟู, ความร่มเย็นเป็นสุข, แสงสว่างนำทางหลังผ่านพ้นความมืดมิด" },
  { id: 18, name: "The Moon", th: "เดอะมูน", img: "https://sacred-texts.com/tarot/pkt/img/ar18.jpg", meaning: "ความกลัว, ภาพลวงตา, ความสับสน, สภาวะจิตใจที่ซับซ้อน อึดอัด และแปรปรวน" },
  { id: 19, name: "The Sun", th: "เดอะซัน", img: "https://sacred-texts.com/tarot/pkt/img/ar19.jpg", meaning: "ความสำเร็จ, ความสุข, พลังงานบวก, ความชัดเจน, ชัยชนะที่สว่างไสวและความสดใส" },
  { id: 20, name: "Judgement", th: "จัดจ์เมนท์", img: "https://sacred-texts.com/tarot/pkt/img/ar20.jpg", meaning: "การตื่นรู้, การประเมินผล, การเกิดใหม่, การได้รับผลตอบแทนจากสิ่งที่เคยกระทำไว้ในอดีต" },
  { id: 21, name: "The World", th: "เดอะเวิลด์", img: "https://sacred-texts.com/tarot/pkt/img/ar21.jpg", meaning: "ความสมบูรณ์, ความสำเร็จสูงสุด, การสิ้นสุดวัฏจักรอย่างสวยงาม, การบรรลุเป้าหมายที่ตั้งไว้" },
  { id: 22, name: "Ace of Wands", th: "1 ไม้เท้า", img: "https://sacred-texts.com/tarot/pkt/img/wa01.jpg", meaning: "แรงบันดาลใจใหม่, โอกาสเรื่องงาน, พลังงานสร้างสรรค์, การเริ่มต้นโปรเจกต์ใหม่" },
  { id: 23, name: "Two of Wands", th: "2 ไม้เท้า", img: "https://sacred-texts.com/tarot/pkt/img/wa02.jpg", meaning: "การวางแผนอนาคต, วิสัยทัศน์กว้างไกล, การรอคอยผลลัพธ์จากการตัดสินใจ" },
  { id: 24, name: "Three of Wands", th: "3 ไม้เท้า", img: "https://sacred-texts.com/tarot/pkt/img/wa03.jpg", meaning: "การขยายตัว, การมองไปข้างหน้า, ความสำเร็จในขั้นต้น, การติดต่อต่างประเทศ" },
  { id: 25, name: "Four of Wands", th: "4 ไม้เท้า", img: "https://sacred-texts.com/tarot/pkt/img/wa04.jpg", meaning: "ความมั่นคง, การเฉลิมฉลอง, ความสำเร็จในครอบครัวหรืองาน, รากฐานที่แข็งแรง" },
  { id: 26, name: "Five of Wands", th: "5 ไม้เท้า", img: "https://sacred-texts.com/tarot/pkt/img/wa05.jpg", meaning: "การแข่งขัน, ความขัดแย้งยิบย่อย, การระดมสมอง, อุปสรรคที่ต้องฝ่าฟัน" },
  { id: 27, name: "Six of Wands", th: "6 ไม้เท้า", img: "https://sacred-texts.com/tarot/pkt/img/wa06.jpg", meaning: "ชัยชนะ, ความภาคภูมิใจ, การได้รับการยอมรับ, ความสำเร็จที่ได้รับเสียงชื่นชม" },
  { id: 28, name: "Seven of Wands", th: "7 ไม้เท้า", img: "https://sacred-texts.com/tarot/pkt/img/wa07.jpg", meaning: "การยืนหยัดต่อสู้, การปกป้องจุดยืนของตน, ความท้าทายที่ต้องใช้ความกล้าหาญ" },
  { id: 29, name: "Eight of Wands", th: "8 ไม้เท้า", img: "https://sacred-texts.com/tarot/pkt/img/wa08.jpg", meaning: "ความรวดเร็ว, ข่าวสารที่พุ่งเข้ามา, การเดินทาง, การดำเนินการที่ฉับไว" },
  { id: 30, name: "Nine of Wands", th: "9 ไม้เท้า", img: "https://sacred-texts.com/tarot/pkt/img/wa09.jpg", meaning: "ความระแวดระวัง, การบาดเจ็บแต่ยังสู้ต่อ, ความอดทนในโค้งสุดท้าย" },
  { id: 31, name: "Ten of Wands", th: "10 ไม้เท้า", img: "https://sacred-texts.com/tarot/pkt/img/wa10.jpg", meaning: "ภาระหนักอึ้ง, ความเหนื่อยล้า, ความรับผิดชอบที่มากเกินไป, ใกล้ถึงจุดหมายแต่เหนื่อยหอบ" },
  { id: 32, name: "Page of Wands", th: "เด็กถือไม้เท้า", img: "https://sacred-texts.com/tarot/pkt/img/wapa.jpg", meaning: "ข่าวดีเรื่องงานหรือการเรียน, ความกระตือรือร้น, ไอเดียใหม่ๆ, ความสดใส" },
  { id: 33, name: "Knight of Wands", th: "อัศวินไม้เท้า", img: "https://sacred-texts.com/tarot/pkt/img/wakn.jpg", meaning: "ความมุ่งมั่น, พลังงานล้นเหลือ, การลงมือทำอย่างรวดเร็ว, การเดินทางกะทันหัน" },
  { id: 34, name: "Queen of Wands", th: "ราชินีไม้เท้า", img: "https://sacred-texts.com/tarot/pkt/img/waqu.jpg", meaning: "ความมั่นใจ, เสน่ห์ดึงดูด, ความเก่งกาจในการจัดการ, ผู้หญิงเก่งและแกร่ง" },
  { id: 35, name: "King of Wands", th: "ราชาไม้เท้า", img: "https://sacred-texts.com/tarot/pkt/img/waki.jpg", meaning: "ความเป็นผู้นำ, วิสัยทัศน์, ผู้มีอำนาจตัดสินใจ, ความสำเร็จในหน้าที่การงานขั้นสูง" },
  { id: 36, name: "Ace of Cups", th: "1 ถ้วย", img: "https://sacred-texts.com/tarot/pkt/img/cu01.jpg", meaning: "ความรักครั้งใหม่, อารมณ์ที่เปี่ยมล้น, ความสุขทางใจ, สัญชาตญาณที่เปิดรับ" },
  { id: 37, name: "Two of Cups", th: "2 ถ้วย", img: "https://sacred-texts.com/tarot/pkt/img/cu02.jpg", meaning: "ความรักที่สมหวัง, การตกลงปลงใจ, ความสัมพันธ์ที่เกื้อกูล, การจับมือร่วมงาน" },
  { id: 38, name: "Three of Cups", th: "3 ถ้วย", img: "https://sacred-texts.com/tarot/pkt/img/cu03.jpg", meaning: "มิตรภาพ, การเฉลิมฉลอง, ความสุขสนุกสนาน, งานปาร์ตี้หรือการรวมตัว" },
  { id: 39, name: "Four of Cups", th: "4 ถ้วย", img: "https://sacred-texts.com/tarot/pkt/img/cu04.jpg", meaning: "ความเบื่อหน่าย, การมองข้ามโอกาส, การเลือกมาก, สภาวะปิดกั้นทางอารมณ์" },
  { id: 40, name: "Five of Cups", th: "5 ถ้วย", img: "https://sacred-texts.com/tarot/pkt/img/cu05.jpg", meaning: "ความสูญเสีย, ความเศร้าโศก, การจมปลักกับอดีต, การลืมมองสิ่งดีๆ ที่ยังเหลืออยู่" },
  { id: 41, name: "Six of Cups", th: "6 ถ้วย", img: "https://sacred-texts.com/tarot/pkt/img/cu06.jpg", meaning: "ความทรงจำวัยเด็ก, เพื่อนเก่า, อดีตคนรัก, ความบริสุทธิ์ใจ, การคืนดี" },
  { id: 42, name: "Seven of Cups", th: "7 ถ้วย", img: "https://sacred-texts.com/tarot/pkt/img/cu07.jpg", meaning: "ทางเลือกมากมาย, ภาพลวงตา, ความฝันกลางวัน, การหลงระเริงกับสิ่งที่ยังไม่เกิดขึ้น" },
  { id: 43, name: "Eight of Cups", th: "8 ถ้วย", img: "https://sacred-texts.com/tarot/pkt/img/cu08.jpg", meaning: "การเดินจากมา, การละทิ้งสิ่งที่เคยสร้าง, การค้นหาความหมายทางจิตวิญญาณ" },
  { id: 44, name: "Nine of Cups", th: "9 ถ้วย", img: "https://sacred-texts.com/tarot/pkt/img/cu09.jpg", meaning: "ความพึงพอใจในตัวเอง, ความสุขสมหวังดั่งใจนึก, การให้รางวัลตัวเอง" },
  { id: 45, name: "Ten of Cups", th: "10 ถ้วย", img: "https://sacred-texts.com/tarot/pkt/img/cu10.jpg", meaning: "ครอบครัวที่อบอุ่น, ความรักที่สมบูรณ์แบบ, ความสุขชื่นมื่น, จุดสูงสุดของความสัมพันธ์" },
  { id: 46, name: "Page of Cups", th: "เด็กถือถ้วย", img: "https://sacred-texts.com/tarot/pkt/img/cupa.jpg", meaning: "ข่าวดีเรื่องความรัก, อารมณ์อ่อนไหว, การแสดงออกทางความรู้สึกที่น่ารักน่าเอ็นดู" },
  { id: 47, name: "Knight of Cups", th: "อัศวินถ้วย", img: "https://sacred-texts.com/tarot/pkt/img/cukn.jpg", meaning: "ความโรแมนติก, ชายหนุ่มเจ้าเสน่ห์, การเข้ามาจีบ, การทำตามหัวใจ" },
  { id: 48, name: "Queen of Cups", th: "ราชินีถ้วย", img: "https://sacred-texts.com/tarot/pkt/img/cuqu.jpg", meaning: "ความเมตตา, ความเข้าอกเข้าใจ, ผู้ให้คำปรึกษาที่ดี, สัญชาตญาณที่แม่นยำ" },
  { id: 49, name: "King of Cups", th: "ราชาถ้วย", img: "https://sacred-texts.com/tarot/pkt/img/cuki.jpg", meaning: "การควบคุมอารมณ์, ความนิ่งสงบ, ผู้ใหญ่ใจดี, ความมั่นคงทางความรู้สึก" },
  { id: 50, name: "Ace of Swords", th: "1 ดาบ", img: "https://sacred-texts.com/tarot/pkt/img/sw01.jpg", meaning: "ชัยชนะเหนืออุปสรรค, ความคิดที่เฉียบขาด, การตัดสินใจเด็ดขาด, จุดเริ่มต้นที่ต้องต่อสู้" },
  { id: 51, name: "Two of Swords", th: "2 ดาบ", img: "https://sacred-texts.com/tarot/pkt/img/sw02.jpg", meaning: "การปิดกั้นตัวเอง, ทางเลือกที่กลืนไม่เข้าคายไม่ออก, สภาวะตึงเครียดที่ต้องรอเวลา" },
  { id: 52, name: "Three of Swords", th: "3 ดาบ", img: "https://sacred-texts.com/tarot/pkt/img/sw03.jpg", meaning: "ความเจ็บปวดใจ, รักสามเส้า, การสูญเสีย, ความผิดหวังอย่างรุนแรง" },
  { id: 53, name: "Four of Swords", th: "4 ดาบ", img: "https://sacred-texts.com/tarot/pkt/img/sw04.jpg", meaning: "การพักฟื้น, การหยุดพักจากปัญหา, การทบทวนตัวเองเงียบๆ, ภาวะจำศีล" },
  { id: 54, name: "Five of Swords", th: "5 ดาบ", img: "https://sacred-texts.com/tarot/pkt/img/sw05.jpg", meaning: "ชัยชนะบนความสูญเสีย, การทะเลาะเบาะแว้ง, ความขัดแย้งที่ไม่มีใครได้ประโยชน์เต็มที่" },
  { id: 55, name: "Six of Swords", th: "6 ดาบ", img: "https://sacred-texts.com/tarot/pkt/img/sw06.jpg", meaning: "การประคองตัวผ่านพ้นปัญหา, การเดินทางโยกย้าย, ปัญหาคลี่คลายลงอย่างช้าๆ" },
  { id: 56, name: "Seven of Swords", th: "7 ดาบ", img: "https://sacred-texts.com/tarot/pkt/img/sw07.jpg", meaning: "การหลบเลี่ยง, ความลับ, การขโมย, การใช้วิธีการที่แยบยลหรือเอาตัวรอด" },
  { id: 57, name: "Eight of Swords", th: "8 ดาบ", img: "https://sacred-texts.com/tarot/pkt/img/sw08.jpg", meaning: "ความมืดแปดด้าน, การถูกจองจำด้วยความคิดตัวเอง, ข้อจำกัดที่มองไม่เห็นทางออก" },
  { id: 58, name: "Nine of Swords", th: "9 ดาบ", img: "https://sacred-texts.com/tarot/pkt/img/sw09.jpg", meaning: "ความวิตกกังวล, นอนไม่หลับ, ความเครียดสะสม, ความกลัวต่อสิ่งที่ยังมาไม่ถึง" },
  { id: 59, name: "Ten of Swords", th: "10 ดาบ", img: "https://sacred-texts.com/tarot/pkt/img/sw10.jpg", meaning: "จุดต่ำสุด, การพังทลาย, การถูกหักหลังอย่างหนัก, ความเจ็บปวดเพื่อรอการเกิดใหม่" },
  { id: 60, name: "Page of Swords", th: "เด็กถือดาบ", img: "https://sacred-texts.com/tarot/pkt/img/swpa.jpg", meaning: "ความอยากรู้อยากเห็น, การใช้เหตุผล, ระวังคำพูด, ข่าวสารที่ต้องตรวจสอบ" },
  { id: 61, name: "Knight of Swords", th: "อัศวินดาบ", img: "https://sacred-texts.com/tarot/pkt/img/swkn.jpg", meaning: "การพุ่งชนปัญหา, ความกล้าหาญที่มุทะลุ, การต่อสู้ไม่ถอย, ระวังอารมณ์ร้อน" },
  { id: 62, name: "Queen of Swords", th: "ราชินีดาบ", img: "https://sacred-texts.com/tarot/pkt/img/swqu.jpg", meaning: "ความเด็ดเดี่ยว, ความชัดเจน, การใช้เหตุผลเหนืออารมณ์, หญิงแกร่งที่ผ่านโลกมามาก" },
  { id: 63, name: "King of Swords", th: "ราชาดาบ", img: "https://sacred-texts.com/tarot/pkt/img/swki.jpg", meaning: "อำนาจ, กฎหมาย, ความยุติธรรม, ผู้นำที่เฉียบขาดและใช้ปัญญาในการปกครอง" },
  { id: 64, name: "Ace of Pentacles", th: "1 เหรียญ", img: "https://sacred-texts.com/tarot/pkt/img/pe01.jpg", meaning: "โชคลาภใหม่, โอกาสทางการเงิน, การเริ่มต้นที่มั่งคั่ง, ของขวัญหรือทรัพย์สิน" },
  { id: 65, name: "Two of Pentacles", th: "2 เหรียญ", img: "https://sacred-texts.com/tarot/pkt/img/pe02.jpg", meaning: "หมุนเงิน, การประคองสถานการณ์, การรักษาสมดุลของสองสิ่ง, การปรับตัว" },
  { id: 66, name: "Three of Pentacles", th: "3 เหรียญ", img: "https://sacred-texts.com/tarot/pkt/img/pe03.jpg", meaning: "การทำงานเป็นทีม, การเรียนรู้ทักษะใหม่, ความก้าวหน้าในอาชีพ, ได้รับการยกย่องในฝีมือ" },
  { id: 67, name: "Four of Pentacles", th: "4 เหรียญ", img: "https://sacred-texts.com/tarot/pkt/img/pe04.jpg", meaning: "ความตระหนี่, การหวงแหนของที่มี, ความกลัวสูญเสีย, การเก็บเงินอย่างระมัดระวัง" },
  { id: 68, name: "Five of Pentacles", th: "5 เหรียญ", img: "https://sacred-texts.com/tarot/pkt/img/pe05.jpg", meaning: "ความยากลำบาก, ปัญหาการเงิน, ความเหน็บหนาวทางจิตใจ, ความรู้สึกขาดแคลน" },
  { id: 69, name: "Six of Pentacles", th: "6 เหรียญ", img: "https://sacred-texts.com/tarot/pkt/img/pe06.jpg", meaning: "การให้และการรับ, ความใจบุญ, การได้รับความช่วยเหลือ, การแบ่งปัน" },
  { id: 70, name: "Seven of Pentacles", th: "7 เหรียญ", img: "https://sacred-texts.com/tarot/pkt/img/pe07.jpg", meaning: "การรอคอยผลกำไร, ความอดทน, การประเมินผลงานที่ทำมา, การลงทุนระยะยาว" },
  { id: 71, name: "Eight of Pentacles", th: "8 เหรียญ", img: "https://sacred-texts.com/tarot/pkt/img/pe08.jpg", meaning: "ความขยันหมั่นเพียร, ความเชี่ยวชาญเฉพาะด้าน, การมุ่งมั่นพัฒนาตัวเอง" },
  { id: 72, name: "Nine of Pentacles", th: "9 เหรียญ", img: "https://sacred-texts.com/tarot/pkt/img/pe09.jpg", meaning: "ความมั่งคั่งส่วนตัว, ความสวยงาม, ความสำเร็จที่เพียบพร้อม, การพึ่งพาตัวเองได้" },
  { id: 73, name: "Ten of Pentacles", th: "10 เหรียญ", img: "https://sacred-texts.com/tarot/pkt/img/pe10.jpg", meaning: "ความสมบูรณ์พูนสุข, มรดก, ธุรกิจครอบครัวที่มั่นคง, ความสำเร็จระดับสูงสุด" },
  { id: 74, name: "Page of Pentacles", th: "เด็กถือเหรียญ", img: "https://sacred-texts.com/tarot/pkt/img/pepa.jpg", meaning: "ข่าวดีเรื่องเงิน, ความตั้งใจเรียนรู้, จุดเริ่มต้นของการลงทุนที่มั่นคง" },
  { id: 75, name: "Knight of Pentacles", th: "อัศวินเหรียญ", img: "https://sacred-texts.com/tarot/pkt/img/pekn.jpg", meaning: "ความหนักแน่น, การทำงานหนักแต่ชัวร์, ความน่าเชื่อถือ, ชายหนุ่มที่มั่นคง" },
  { id: 76, name: "Queen of Pentacles", th: "ราชินีเหรียญ", img: "https://sacred-texts.com/tarot/pkt/img/pequ.jpg", meaning: "ความใจกว้าง, ผู้หญิงที่เก่งเรื่องการเงินและดูแลครอบครัว, ความอุดมสมบูรณ์" },
  { id: 77, name: "King of Pentacles", th: "ราชาเหรียญ", img: "https://sacred-texts.com/tarot/pkt/img/peki.jpg", meaning: "ความสำเร็จทางการเงินระดับสูง, ผู้มีอำนาจทางธุรกิจ, ความมั่งคั่งและเสถียรภาพ" }
];

const POSITIONS = [
  { id: 1, name: "สถานการณ์ปัจจุบัน", desc: "ภาพรวมชีวิตของคุณ ณ วินาทีนี้" },
  { id: 2, name: "สิ่งท้าทาย / อุปสรรค", desc: "ด่านทดสอบที่คุณกำลังเผชิญหน้า" },
  { id: 3, name: "รากฐานของปัญหา", desc: "จุดเริ่มต้นหรือสิ่งที่ฝังลึกอยู่ในใจ" },
  { id: 4, name: "อดีตที่เพิ่งพ้นผ่าน", desc: "เหตุการณ์ที่เพิ่งจบลงแต่ยังมีควันหลง" },
  { id: 5, name: "เป้าหมายในใจ", desc: "สิ่งที่คุณวาดฝันหรือมุ่งมั่นอยากให้เป็น" },
  { id: 6, name: "อนาคตอันใกล้", desc: "ก้าวต่อไปที่กำลังจะเกิดขึ้นเร็วๆ นี้" },
  { id: 7, name: "ตัวตนของคุณ", desc: "วิธีที่คุณใช้รับมือกับโลกในตอนนี้" },
  { id: 8, name: "สภาพแวดล้อม", desc: "คนรอบตัวหรือบรรยากาศที่ส่งผลกระทบกับคุณ" },
  { id: 9, name: "ความหวัง/ความกลัว", desc: "เสียงกระซิบในใจที่คุณอาจไม่กล้าบอกใคร" },
  { id: 10, name: "บทสรุป", desc: "ปลายทางของเรื่องราวในตอนนี้" }
];

const QUESTION_TOPICS = [
  { id: 'work', label: '💼 การงาน' },
  { id: 'finance', label: '💰 การเงิน' },
  { id: 'love', label: '❤️ ความรัก' },
  { id: 'health', label: '🏥 สุขภาพ' },
  { id: 'family', label: '👨‍👩‍👧‍👦 ครอบครัว' },
  { id: 'luck', label: '✨ โชคลาภ/จังหวะชีวิต' }
];

const LAYOUT_10_MOBILE = [
  { l: 28, t: 25, rot: 0 }, { l: 28, t: 27, rot: 90 }, { l: 28, t: 38, rot: 0 }, { l: 10, t: 25, rot: 0 }, { l: 28, t: 12, rot: 0 },
  { l: 46, t: 25, rot: 0 }, { l: 75, t: 40, rot: 0 }, { l: 75, t: 30, rot: 0 }, { l: 75, t: 20, rot: 0 }, { l: 75, t: 10, rot: 0 }
];
const LAYOUT_10_DESKTOP = [
  { l: 35, t: 50, rot: 0 }, { l: 35, t: 50, rot: 90 }, { l: 35, t: 80, rot: 0 }, { l: 15, t: 50, rot: 0 }, { l: 35, t: 20, rot: 0 },
  { l: 55, t: 50, rot: 0 }, { l: 80, t: 85, rot: 0 }, { l: 80, t: 63, rot: 0 }, { l: 80, t: 41, rot: 0 }, { l: 80, t: 19, rot: 0 }
];

const LAYOUT_3_MOBILE  = [{ l: 20, t: 18, rot: -5 }, { l: 50, t: 18, rot: 0 }, { l: 80, t: 18, rot: 5 }];
const LAYOUT_3_DESKTOP = [{ l: 25, t: 20, rot: -5 }, { l: 50, t: 20, rot: 0 }, { l: 75, t: 20, rot: 5 }];

// ---------------------------------------------------------------------------
// Pure Helpers
// ---------------------------------------------------------------------------
const buildShuffledDeck = () => {
  const deck = [...TAROT_DECK];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck.map((card, i) => ({ ...card, deckIndex: i }));
};

const fetchWithRetry = async (url, options, { retries = 3, timeoutMs = 20000, signal } = {}) => {
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');

    const ac = new AbortController();
    const fwd = () => ac.abort();
    signal?.addEventListener('abort', fwd, { once: true });
    const timer = setTimeout(() => ac.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...options, signal: ac.signal });
      clearTimeout(timer);
      signal?.removeEventListener('abort', fwd);

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new DOMException(`Auth Error ${res.status}`, 'AuthError');
        }
        const isRateLimit = res.status === 429;
        lastErr = new Error(`HTTP ${res.status}`);
        if (attempt < retries - 1) {
          const baseDelay = isRateLimit ? 2000 : 1000;
          await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, attempt)));
        }
        continue;
      }
      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      signal?.removeEventListener('abort', fwd);
      lastErr = err;
      // signal?.aborted จริง = ผู้เรียกยกเลิกเอง (เช่น เริ่มรอบทำนายใหม่ทับ) -> เลิกทันที ไม่ retry
      // ส่วน AbortError ที่เกิดจาก timer ของเราเอง (timeoutMs หมด) ให้ถือเป็นความล้มเหลวชั่วคราว retry ได้ตามปกติ
      if (signal?.aborted || err.name === 'AuthError') throw err;
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastErr;
};

// เรียก Netlify Function (netlify/functions/tarot-ai.js) — server เก็บ system prompt + API key ไว้ทั้งหมด
// client ส่งแค่ type + ข้อมูลดิบที่จำเป็น แล้วได้ JSON กลับมาตรงๆ ไม่ต้องแกะ response format ของโมเดลเอง
// timeoutMs ปรับได้ต่อ endpoint: การทำนาย 10 ใบตอบข้อมูลเยอะกว่า (framework Hook->Keys->Do/Don't->Conclusion x10) เลยให้เวลามากกว่า
const callTarotAPI = async (type, payload, signal, timeoutMs = 20000) => {
  return fetchWithRetry(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, ...payload })
  }, { signal, timeoutMs });
};

// ---------------------------------------------------------------------------
// Initial State Factory
// ---------------------------------------------------------------------------
const createInitialState = () => ({
  gameState: 'intro',
  deck: buildShuffledDeck(),
  selectedCards: [],
  readingIndex: 0,
  revealed: new Array(10).fill(false),
  aiReadings: [],
  aiSummary: "",
  isFallbackMode: false,
  selectedTopic: "",
  customQuestion: "",
  questionAnswer: "",
  base10Cards: [],
  baseSummary: "",
  muteluTips: null,
  muteluReturnState: null,
  dreamText: ""
});

const FallbackBadge = ({ small }) => (
  <div className={`flex items-center gap-2 bg-red-900/40 border border-red-500/40 text-red-300 text-xs px-3 py-1.5 rounded-full ${small ? 'mb-4 w-fit' : 'mb-4 mx-auto animate-pulse justify-center'}`}>
    <AlertCircle className="w-4 h-4 flex-shrink-0" />
    <span>กำลังใช้โหมดปลอบประโลมใจ (AI ชั่วคราว)</span>
  </div>
);

const fallbackMutelu = {
  make_merit: "การได้ช่วยเหลือผู้อื่น เช่น การทำบุญกับมูลนิธิเด็ก เยาวชน หรือสัตว์จรจัด จะช่วยเยียวยาจิตใจและเติมเต็มพลังบวกให้คุณก้าวผ่านช่วงเวลานี้ไปได้ครับ",
  lucky_item: "เสื้อผ้าโทนสีอ่อนสบายตา หรือของชิ้นเล็กๆ ที่มีความทรงจำดีๆ เพื่อเป็นที่พึ่งทางใจ",
  lucky_number: "9, 4 (ตัวเลขแห่งความสงบและการฟื้นฟูจิตใจ)"
};

// ---------------------------------------------------------------------------
// Component: ReadingBlock — เรนเดอร์คำทำนายตาม framework Hook -> Keys -> Do/Don't -> Conclusion
// ---------------------------------------------------------------------------
const ReadingBlock = ({ reading }) => {
  if (!reading) return null;
  return (
    <div className="space-y-4 text-left">
      <p className="text-indigo-50 text-base md:text-lg leading-relaxed font-semibold">
        {reading.hook}
      </p>

      <div className="space-y-2">
        {[
          { title: reading.key1_title, desc: reading.key1_desc },
          { title: reading.key2_title, desc: reading.key2_desc },
        ].filter(k => k.title).map((k, i) => (
          <div key={i} className="bg-indigo-950/40 border border-indigo-500/20 rounded-lg p-3">
            <p className="text-yellow-300 font-semibold text-sm mb-1">{k.title}</p>
            <p className="text-indigo-100 text-sm leading-relaxed">{k.desc}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-3">
          <p className="text-emerald-300 font-semibold text-xs mb-1">✅ ควรทำ</p>
          <p className="text-indigo-100 text-sm leading-relaxed">{reading.do}</p>
        </div>
        <div className="bg-rose-900/20 border border-rose-500/30 rounded-lg p-3">
          <p className="text-rose-300 font-semibold text-xs mb-1">🚫 ควรเลี่ยง</p>
          <p className="text-indigo-100 text-sm leading-relaxed">{reading.dont}</p>
        </div>
      </div>

      <p className="text-yellow-100 text-base italic border-t border-indigo-500/20 pt-3">
        {reading.conclusion}
      </p>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Component: TarotCard
// ---------------------------------------------------------------------------
const TarotCard = React.memo(({ card, style, isSelectable, isReadable, onClick }) => {
  const [imgError, setImgError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const handleImgError = () => {
    if (retryKey < 2) {
      setTimeout(() => setRetryKey(k => k + 1), 800 * (retryKey + 1));
    } else {
      setImgError(true);
    }
  };

  return (
    <div
      onClick={onClick}
      className={`tarot-card absolute w-[60px] h-[100px] sm:w-[80px] sm:h-[135px] md:w-[100px] md:h-[170px] ${isSelectable ? 'hoverable pointer-events-auto hover:-translate-y-4' : ''} ${isReadable ? 'glow-pulse cursor-pointer pointer-events-auto' : ''}`}
      style={style}
    >
      <div className="tarot-face tarot-back">
        <div className="w-8 h-8 rounded-full border border-yellow-500/30"></div>
      </div>
      <div className="tarot-face tarot-front">
        <span>{card.th}<br/><br/>{card.name}</span>
        {!imgError && (
          <img
            key={retryKey}
            src={`https://wsrv.nl/?url=${card.img.replace('https://', '')}&w=220&output=webp&q=75&default=1`}
            alt={card.th}
            loading="lazy"
            onError={handleImgError}
          />
        )}
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.isSelectable === next.isSelectable &&
         prev.isReadable === next.isReadable &&
         prev.style.left === next.style.left &&
         prev.style.top === next.style.top &&
         prev.style.transform === next.style.transform;
});

// ---------------------------------------------------------------------------
// Main App Component
// ---------------------------------------------------------------------------
export default function App() {
  const [state, setState] = useState(createInitialState);
  const [isMobile, setIsMobile] = useState(false);

  const isMountedRef = useRef(true);
  const genIdRef = useRef(0);
  const abortRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const cancelGeneration = useCallback(() => {
    genIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const safeSetState = useCallback((capturedGenId, updater) => {
    if (!isMountedRef.current) return;
    if (genIdRef.current !== capturedGenId) return;
    setState(updater);
  }, []);

  // --- AI Gen 1: ดูดวงภาพรวม (10 Cards) ---
  const generateAllAIReadings = useCallback(async (cards) => {
    const genId = genIdRef.current;
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const POSITION_NAMES = ['ปัจจุบัน','อุปสรรค','รากฐาน','อดีต','เป้าหมาย','อนาคต','ตัวตน','แวดล้อม','หวัง/กลัว','สรุป'];
      const cardsPayload = cards.map((c, i) => ({ position: POSITION_NAMES[i], meaning: c.meaning }));

      const data = await callTarotAPI('reading10', { cards: cardsPayload }, ac.signal, 35000);

      if (!Array.isArray(data?.readings) || data.readings.length !== 10 || typeof data.summary !== 'string' || !data.mutelu) {
        throw new Error('Bad structure');
      }

      safeSetState(genId, prev => ({
        ...prev,
        aiReadings: data.readings,
        aiSummary: data.summary,
        muteluTips: data.mutelu,
        isFallbackMode: false,
        gameState: 'reading'
      }));
    } catch (err) {
      // ยกเลิกจริง (เช่น มีการเริ่มทำนายรอบใหม่ทับ) -> ไม่ต้องทำอะไรต่อ ปล่อยให้รอบใหม่จัดการ state เอง
      if (ac.signal.aborted) return;
      console.warn('[TarotApp] AI Generation Error:', err.message);
      safeSetState(genId, prev => ({
        ...prev,
        aiReadings: cards.map(c => ({
          hook: `ลึกๆ แล้วจิตใจของคุณในตอนนี้กำลังสะท้อนถึงเรื่องราวของ ${c.meaning.split(',')[0]}`,
          key1_title: 'สิ่งที่กำลังเกิดขึ้น',
          key1_desc: 'ไม่เป็นไรเลยที่จะรู้สึกแบบนี้ในตอนนี้',
          key2_title: 'สิ่งที่ควรรู้',
          key2_desc: 'ทุกความรู้สึกล้วนมีเหตุผลของมันเสมอ',
          do: 'อนุญาตให้ตัวเองได้รู้สึกและพักผ่อนใจ',
          dont: 'อย่าเร่งรัดตัวเองให้หาคำตอบทันที',
          conclusion: 'ค่อยๆ โอบกอดมันเพื่อก้าวต่อไปนะครับ'
        })),
        aiSummary: "ช่วงเวลานี้อาจมีเรื่องให้ทบทวนและจัดการมากมาย แต่เชื่อเถอะครับว่าคุณมีพลังความเข้มแข็งซ่อนอยู่ภายในเสมอ ค่อยๆ ก้าวไปทีละก้าว ไม่ต้องรีบร้อนนะครับ",
        muteluTips: fallbackMutelu,
        isFallbackMode: true,
        gameState: 'reading'
      }));
    }
  }, [safeSetState]);

  // --- AI Gen 2: ดูดวงเฉพาะเรื่อง (3 Cards) ---
  const generate3CardReading = useCallback(async (cards, topic, question, baseSummaryText) => {
    const genId = genIdRef.current;
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const data = await callTarotAPI('reading3', {
        topic,
        question,
        cardMeanings: cards.map(c => c.meaning),
        baseSummary: baseSummaryText
      }, ac.signal, 25000);

      if (!data?.answer || typeof data.answer !== 'object' || !data.mutelu) throw new Error('Bad structure');

      safeSetState(genId, prev => ({
        ...prev,
        questionAnswer: data.answer,
        muteluTips: data.mutelu,
        isFallbackMode: false,
        gameState: 'reading_3',
        revealed: new Array(3).fill(true)
      }));
    } catch (err) {
      if (ac.signal.aborted) return;
      console.warn('[TarotApp] 3-Card AI Error:', err.message);
      safeSetState(genId, prev => ({
        ...prev,
        questionAnswer: {
          hook: 'สำหรับเรื่องที่คุณกังวลอยู่ ไม่เป็นไรเลยที่จะรู้สึกสับสนในตอนนี้',
          key1_title: 'สถานการณ์ตอนนี้',
          key1_desc: 'บางเรื่องต้องใช้เวลาตกตะกอนก่อนจะเห็นทางออกชัดเจน',
          key2_title: 'สิ่งที่ซ่อนอยู่ในใจ',
          key2_desc: 'คำตอบที่แท้จริงมักอยู่ใกล้กว่าที่คิดเสมอ',
          do: 'ให้เวลาตัวเองได้ทบทวนอย่างใจเย็น',
          dont: 'อย่าตัดสินใจเรื่องสำคัญตอนใจยังไม่นิ่ง',
          conclusion: 'แล้วคุณจะพบคำตอบที่ถูกต้องจากเสียงข้างในหัวใจคุณเองครับ'
        },
        muteluTips: fallbackMutelu,
        isFallbackMode: true,
        gameState: 'reading_3',
        revealed: new Array(3).fill(true)
      }));
    }
  }, [safeSetState]);

  // --- AI Gen 3: ฟีเจอร์ใหม่ ✨ ถอดรหัสฝันเป็นไพ่ทาโรต์ ---
  const generateDreamAnalysis = useCallback(async (dream) => {
    const genId = genIdRef.current;
    const ac = new AbortController();
    abortRef.current = ac;

    setState(prev => ({ ...prev, gameState: 'generating_dream' }));

    try {
      const data = await callTarotAPI('dream', { dream }, ac.signal, 25000);

      if (!Array.isArray(data?.cardIds) || data.cardIds.length !== 3 || !data?.answer || typeof data.answer !== 'object' || !data.mutelu) {
        throw new Error('Bad structure');
      }

      const selectedDreamCards = data.cardIds.map(id => {
          const found = TAROT_DECK.find(c => c.id === id);
          return found || TAROT_DECK[0];
      }).map((card, i) => ({...card, deckIndex: i}));

      safeSetState(genId, prev => ({
        ...prev,
        selectedCards: selectedDreamCards,
        selectedTopic: "ถอดรหัสความฝัน",
        customQuestion: `"${dream.slice(0, 30)}${dream.length > 30 ? '...' : ''}"`,
        questionAnswer: data.answer,
        muteluTips: data.mutelu,
        isFallbackMode: false,
        gameState: 'reading_dream',
        revealed: new Array(3).fill(true)
      }));
    } catch (err) {
      if (ac.signal.aborted) return;
      console.warn('[TarotApp] Dream AI Error:', err.message);
      const fallbackCards = [TAROT_DECK[18], TAROT_DECK[2], TAROT_DECK[17]].map((c,i)=>({...c, deckIndex: i}));
      safeSetState(genId, prev => ({
        ...prev,
        selectedCards: fallbackCards,
        selectedTopic: "ถอดรหัสความฝัน",
        customQuestion: `"${dream.slice(0, 30)}..."`,
        questionAnswer: {
          hook: 'จิตใต้สำนึกของคุณกำลังพยายามสื่อสารบางอย่างผ่านความฝันนี้',
          key1_title: 'ความหมายที่เป็นไปได้',
          key1_desc: 'อาจเป็นความกังวลลึกๆ หรือลางสังหรณ์บางอย่าง',
          key2_title: 'สิ่งที่ควรฟัง',
          key2_desc: 'สัญชาตญาณของคุณมักรู้ก่อนความคิดเสมอ',
          do: 'เชื่อมั่นในสัญชาตญาณของตัวเอง',
          dont: 'อย่าเพิกเฉยต่อความรู้สึกที่ฝันทิ้งไว้',
          conclusion: 'ขอให้คุณโอบกอดความรู้สึกเหล่านี้นะครับ'
        },
        muteluTips: fallbackMutelu,
        isFallbackMode: true,
        gameState: 'reading_dream',
        revealed: new Array(3).fill(true)
      }));
    }
  }, [safeSetState]);

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------
  const handleStart = useCallback(() => setState(prev => ({ ...prev, gameState: 'spread' })), []);

  const handleSelectCard = useCallback((card) => {
    setState(prev => {
      const is10 = prev.gameState === 'spread';
      const is3  = prev.gameState === 'spread_3';
      if (!is10 && !is3) return prev;
      if (prev.selectedCards.some(c => c.id === card.id)) return prev;

      const max = is10 ? 10 : 3;
      if (prev.selectedCards.length >= max) return prev;

      const newSelected = [...prev.selectedCards, card];
      const capturedTopic = prev.selectedTopic;
      const capturedQuestion = prev.customQuestion;
      const capturedSummary = prev.baseSummary || prev.aiSummary;

      if (newSelected.length === max) {
        setTimeout(() => {
          cancelGeneration();
          genIdRef.current += 1;
          if (is10) generateAllAIReadings(newSelected);
          else generate3CardReading(newSelected, capturedTopic, capturedQuestion, capturedSummary);
        }, 0);
        return { ...prev, selectedCards: newSelected, gameState: is10 ? 'generating' : 'generating_3' };
      }

      return { ...prev, selectedCards: newSelected };
    });
  }, [cancelGeneration, generateAllAIReadings, generate3CardReading]);

  const handleReveal = useCallback((index) => {
    setState(prev => {
      if (prev.gameState !== 'reading' || index !== prev.readingIndex || prev.revealed[index]) return prev;
      const r = [...prev.revealed];
      r[index] = true;
      return { ...prev, revealed: r };
    });
  }, []);

  const nextReading = useCallback(() => {
    setState(prev => prev.readingIndex < 9 ? { ...prev, readingIndex: prev.readingIndex + 1 } : { ...prev, gameState: 'summary' });
  }, []);

  const handleReset = useCallback(() => {
    cancelGeneration();
    setState(createInitialState());
  }, [cancelGeneration]);

  const handlePrepareQuestion = useCallback(() => {
    cancelGeneration();
    setState(prev => ({
      ...prev,
      base10Cards: prev.gameState === 'summary' || prev.muteluReturnState === 'summary' ? prev.selectedCards : prev.base10Cards,
      baseSummary: prev.gameState === 'summary' || prev.muteluReturnState === 'summary' ? prev.aiSummary : prev.baseSummary,
      gameState: 'ask_question',
      deck: buildShuffledDeck(),
      selectedCards: [],
      selectedTopic: '',
      customQuestion: '',
      questionAnswer: '',
      revealed: new Array(3).fill(false),
      muteluTips: null,
      muteluReturnState: null,
      dreamText: ''
    }));
  }, [cancelGeneration]);

  const handleStartQuestionSpread = useCallback(() => {
    setState(prev => (!prev.selectedTopic ? prev : { ...prev, gameState: 'spread_3' }));
  }, []);

  const handleTopicSelect = useCallback((label) => {
    setState(prev => ({ ...prev, selectedTopic: label }));
  }, []);

  const handleQuestionInput = useCallback((e) => {
    setState(prev => ({ ...prev, customQuestion: e.target.value }));
  }, []);

  const handleShowMutelu = useCallback(() => {
    setState(prev => ({
      ...prev,
      muteluReturnState: prev.gameState,
      gameState: 'reading_mutelu'
    }));
  }, []);

  const handleBackFromMutelu = useCallback(() => {
    setState(prev => ({ ...prev, gameState: prev.muteluReturnState }));
  }, []);

  // ---------------------------------------------------------------------------
  // Card Positioning Calculator
  // ---------------------------------------------------------------------------
  const getCardStyle = useCallback((card) => {
    const { gameState, selectedCards, readingIndex, revealed, deck, muteluReturnState } = state;

    const currentLayoutState = gameState === 'reading_mutelu' ? muteluReturnState : gameState;

    const selIndex  = selectedCards.findIndex(c => c.id === card.id);
    const isSelected = selIndex !== -1;

    let left = '50%', top = '50%', zIndex = card.deckIndex ?? 0, opacity = 1;
    let transform = 'translate(-50%, -50%) scale(0)';

    switch (currentLayoutState) {
      case 'intro':
      case 'dream_input': {
        transform = `translate(-50%, -50%) scale(0)`;
        break;
      }
      case 'spread': {
        if (isSelected) {
          left = `${10 + selIndex * 8.8}%`;
          top  = isMobile ? '85%' : '85%';
          transform = `translate(-50%, -50%) scale(${isMobile ? 0.45 : 0.6})`;
          zIndex = 100 + selIndex;
        } else {
          const rowsCount = isMobile ? 5 : 3;
          const colsCount = Math.ceil(deck.length / rowsCount);
          const row = Math.floor(card.deckIndex / colsCount);
          const col = card.deckIndex % colsCount;

          const cardsInThisRow = row === rowsCount - 1 ? (deck.length % colsCount || colsCount) : colsCount;
          const spacingX = 90 / (colsCount - 1);
          const startLeft = 50 - ((cardsInThisRow - 1) * spacingX) / 2;

          left = `${startLeft + col * spacingX}%`;
          top = `${isMobile ? 28 + (row * 10) : 32 + (row * 14)}%`;
          transform = `translate(-50%, -50%) scale(${isMobile ? 0.32 : 0.45})`;
          zIndex = card.deckIndex;
        }
        break;
      }
      case 'generating':
      case 'reading':
      case 'summary': {
        if (!isSelected) { opacity = 0; break; }
        const pos = (isMobile ? LAYOUT_10_MOBILE : LAYOUT_10_DESKTOP)[selIndex];
        const isFlipped = revealed[selIndex];
        left = `${pos.l}%`;
        top = `${pos.t}%`;
        let scale = isMobile ? 0.65 : 0.85;
        if (currentLayoutState === 'reading' && selIndex === readingIndex && !isFlipped) scale = isMobile ? 0.75 : 1.05;
        transform = `translate(-50%, -50%) rotate(${pos.rot}deg) ${isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'} scale(${scale})`;
        zIndex = selIndex === 1 ? 110 : 100 + selIndex;
        break;
      }
      case 'spread_3': {
        if (isSelected) {
          left = `${30 + selIndex * 20}%`;
          top  = isMobile ? '85%' : '85%';
          transform = `translate(-50%, -50%) scale(${isMobile ? 0.5 : 0.6})`;
          zIndex = 100 + selIndex;
        } else {
          const rowsCount = isMobile ? 5 : 3;
          const colsCount = Math.ceil(deck.length / rowsCount);
          const row = Math.floor(card.deckIndex / colsCount);
          const col = card.deckIndex % colsCount;

          const cardsInThisRow = row === rowsCount - 1 ? (deck.length % colsCount || colsCount) : colsCount;
          const spacingX = 90 / (colsCount - 1);
          const startLeft = 50 - ((cardsInThisRow - 1) * spacingX) / 2;

          left = `${startLeft + col * spacingX}%`;
          top = `${isMobile ? 28 + (row * 10) : 32 + (row * 14)}%`;
          transform = `translate(-50%, -50%) scale(${isMobile ? 0.32 : 0.45})`;
          zIndex = card.deckIndex;
        }
        break;
      }
      case 'generating_3':
      case 'reading_3':
      case 'generating_dream':
      case 'reading_dream': {
        if (!isSelected) { opacity = 0; break; }
        const pos = (isMobile ? LAYOUT_3_MOBILE : LAYOUT_3_DESKTOP)[selIndex];
        const isFlipped = revealed[selIndex];
        left = `${pos.l}%`;
        top  = `${pos.t}%`;
        const currentScale = isMobile ? 0.55 : 0.75;
        transform = `translate(-50%, -50%) rotate(${pos.rot}deg) ${isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'} scale(${currentScale})`;
        zIndex = 100 + selIndex;
        break;
      }
      default: break;
    }

    return {
      left, top, transform, zIndex, opacity,
      pointerEvents: opacity === 0 ? 'none' : undefined,
      transition: 'all 0.6s cubic-bezier(0.25, 0.8, 0.25, 1)',
    };
  }, [state, isMobile]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const { gameState, deck, selectedCards, readingIndex, revealed, aiReadings, aiSummary, isFallbackMode, selectedTopic, customQuestion, questionAnswer, muteluTips, muteluReturnState, dreamText } = state;

  return (
    <div className="min-h-screen bg-slate-900 font-sans overflow-hidden flex flex-col relative w-full h-full">
      <style dangerouslySetInnerHTML={{__html: `
        .tarot-container { perspective: 1200px; }
        .tarot-card { transform-style: preserve-3d; }
        .tarot-face { backface-visibility: hidden; position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
        .tarot-back { background: radial-gradient(circle, #2a1b54 0%, #0b071a 100%); border: 4px solid #d4af37; display: flex; align-items: center; justify-content: center; transform: rotateY(0deg); }
        .tarot-back::after { content: ''; position: absolute; width: 80%; height: 80%; border: 1px solid rgba(212, 175, 55, 0.5); border-radius: 4px; }
        .tarot-front { transform: rotateY(180deg); background-color: #1e293b; border: 4px solid #fff; display: flex; align-items: center; justify-content: center; flex-direction: column; text-align: center; overflow: hidden; }
        .tarot-front span { color: #94a3b8; font-size: 0.75rem; font-weight: bold; z-index: 1; padding: 0.5rem; }
        .tarot-front img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; border-radius: 2px; z-index: 2; background-color: #fdf5e6; }

        .tarot-card.hoverable:hover { filter: brightness(1.2); cursor: pointer; }
        .glow-pulse { animation: pulseGlow 2s infinite; }
        @keyframes pulseGlow { 0% { box-shadow: 0 0 10px #d4af37; } 50% { box-shadow: 0 0 25px #d4af37; } 100% { box-shadow: 0 0 10px #d4af37; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.4s ease-out; }
      `}} />

      {/* Header */}
      <header className="p-4 text-center z-50 relative bg-black/40 backdrop-blur-sm border-b border-indigo-500/30 w-full">
        <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 flex items-center justify-center gap-2">
          <Sparkles className="w-6 h-6 text-yellow-400" />
          ให้ Too AI เล่าเรื่องดวงคุณ
          <Sparkles className="w-6 h-6 text-yellow-400" />
        </h1>
        <p className="text-indigo-200 text-sm mt-1 tracking-wider">พลังแห่งการเยียวยาจิตใจ ขับเคลื่อนด้วย AI</p>
      </header>

      {/* Main Play Area */}
      <main className="flex-1 relative tarot-container w-full max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-center p-4">

        {/* The 3D Cards Layer */}
        <div className={`absolute inset-0 h-full pointer-events-none ${['reading', 'summary'].includes(gameState) ? 'w-full md:w-[55%] lg:w-[60%]' : 'w-full'} ${['generating_3', 'reading_3', 'generating_dream', 'reading_dream', 'reading_mutelu'].includes(gameState) ? 'z-50' : 'z-10'}`}>
          {deck.map((card) => {
            const style = getCardStyle(card);
            const isSelectable = (gameState === 'spread' || gameState === 'spread_3') && !selectedCards.find(c => c.id === card.id);
            const isReadable = gameState === 'reading' && selectedCards[readingIndex]?.id === card.id && !revealed[readingIndex];

            return (
              <TarotCard
                key={card.id}
                card={card}
                style={style}
                isSelectable={isSelectable}
                isReadable={isReadable}
                onClick={() => {
                  if (isSelectable) handleSelectCard(card);
                  else if (isReadable) handleReveal(readingIndex);
                }}
              />
            );
          })}
        </div>

        {/* UI Overlay Area */}
        <div className="z-40 w-full h-full flex flex-col justify-end md:justify-center md:items-end pointer-events-none absolute inset-0 pb-4">

          {/* หน้า Intro เริ่มต้น */}
          {gameState === 'intro' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/50 backdrop-blur-sm z-50 fade-in px-4">
              <div className="bg-slate-800/90 border border-yellow-500/50 p-8 rounded-2xl w-full max-w-md text-center shadow-2xl">
                <h2 className="text-2xl text-yellow-400 font-bold mb-4">ยินดีต้อนรับสู่พื้นที่ปลอดภัย</h2>
                <p className="text-indigo-100 mb-6 leading-relaxed text-sm">
                  เลือกรูปแบบการทำนายที่คุณต้องการ เพื่อให้ AI ถ่ายทอดชะตาชีวิตและช่วยโอบกอดความรู้สึกของคุณ
                </p>
                <div className="flex flex-col gap-4">
                    <button
                      onClick={handleStart}
                      className="w-full py-3.5 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(234,179,8,0.4)] transform hover:scale-105"
                    >
                      เริ่มทำนายภาพรวม (10 ใบ)
                    </button>
                    <button
                      onClick={() => setState(prev => ({...prev, gameState: 'dream_input', dreamText: ''}))}
                      className="w-full py-3.5 bg-indigo-900/50 border border-fuchsia-500/50 hover:bg-fuchsia-900/40 text-fuchsia-300 font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(217,70,239,0.2)] transform hover:scale-105 flex items-center justify-center gap-2"
                    >
                      <Moon className="w-5 h-5" /> ✨ ให้ AI ถอดรหัสความฝัน
                    </button>
                </div>
              </div>
            </div>
          )}

          {/* หน้าต่างกรอกความฝัน */}
          {gameState === 'dream_input' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/60 backdrop-blur-md z-50 fade-in px-4">
              <div className="bg-slate-800 border border-fuchsia-500/50 p-6 md:p-8 rounded-3xl w-full max-w-xl shadow-2xl">
                <div className="flex items-center justify-center gap-3 mb-6 text-fuchsia-400">
                  <Moon className="w-8 h-8" />
                  <h2 className="text-2xl font-bold">ถอดรหัสความฝัน</h2>
                </div>
                <p className="text-indigo-200 mb-4 text-sm text-center">
                  เล่าความฝันที่ติดอยู่ในใจคุณให้ AI ฟัง แล้วเราจะค้นหาไพ่ทาโรต์ 3 ใบที่ซ่อนอยู่ในจิตใต้สำนึกของคุณ
                </p>
                <textarea
                  value={dreamText}
                  onChange={(e) => setState(prev => ({...prev, dreamText: e.target.value}))}
                  placeholder="เมื่อคืนฉันฝันว่า..."
                  className="w-full bg-slate-900 border border-fuchsia-500/50 text-white placeholder-slate-500 rounded-xl p-4 focus:outline-none focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400 mb-6 transition-all min-h-[120px] resize-none"
                />
                <div className="flex flex-col md:flex-row gap-3">
                  <button
                    onClick={() => generateDreamAnalysis(dreamText)}
                    disabled={!dreamText}
                    className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center transition-all ${dreamText ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white shadow-[0_0_15px_rgba(217,70,239,0.4)] hover:scale-105' : 'bg-slate-700 text-slate-400 cursor-not-allowed'}`}
                  >
                    <Sparkles className="w-5 h-5 mr-2" /> ให้ AI ทำนายฝัน
                  </button>
                  <button
                    onClick={handleReset}
                    className="md:w-1/3 py-3 rounded-xl font-medium text-slate-300 hover:bg-slate-700 transition-all border border-slate-600"
                  >
                    กลับหน้าแรก
                  </button>
                </div>
              </div>
            </div>
          )}

          {gameState === 'spread' && (
            <div className="absolute top-6 md:top-8 left-1/2 -translate-x-1/2 w-[90%] max-w-md text-center pointer-events-auto fade-in z-50">
              <div className="inline-block bg-slate-800/90 backdrop-blur-md border border-indigo-500/50 px-6 py-3 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                <p className="text-yellow-400 font-medium text-base md:text-lg">
                  หยิบไพ่มา {selectedCards.length} / 10 ใบ
                </p>
                <p className="text-indigo-200 text-xs md:text-sm mt-1">ปล่อยใจสบายๆ แล้วคลิกไพ่ใบที่สะดุดตาที่สุด</p>
              </div>
            </div>
          )}

          {/* AI Generating Overlays */}
          {(gameState === 'generating' || gameState === 'generating_3' || gameState === 'generating_dream') && (
            <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-auto bg-slate-900/80 backdrop-blur-md fade-in">
              <div className="flex flex-col items-center justify-center text-center p-8 bg-slate-800/50 border border-indigo-500/50 rounded-3xl shadow-2xl">
                <div className="relative">
                  <Star className="w-16 h-16 text-yellow-500 animate-spin opacity-20 absolute top-0 left-0" style={{ animationDuration: '3s' }} />
                  <Loader2 className="w-16 h-16 text-yellow-400 animate-spin drop-shadow-[0_0_15px_rgba(234,179,8,0.8)]" />
                </div>
                <h3 className="text-2xl font-bold text-yellow-300 mt-6 mb-2">
                  {gameState === 'generating_dream' ? 'กำลังเดินทางเข้าสู่ความฝัน...' : 'ดวงดาวกำลังจัดเรียง'}
                </h3>
                <p className="text-indigo-200 text-lg animate-pulse">
                  {gameState === 'generating_dream' ? 'AI กำลังค้นหาไพ่ที่ตรงกับจิตใต้สำนึกของคุณ' : 'รอแป๊บนึงนะ... AI กำลังร้อยเรียงเรื่องราวของคุณอยู่'}
                </p>
              </div>
            </div>
          )}

          {gameState === 'reading' && !revealed[readingIndex] && isMobile && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-sm text-center pointer-events-none z-50 fade-in">
              <div className="inline-flex flex-col items-center gap-1 bg-slate-800/95 backdrop-blur-md border border-yellow-500/50 px-6 py-4 rounded-2xl shadow-[0_0_20px_rgba(234,179,8,0.2)]">
                <p className="text-indigo-200 text-xs font-bold tracking-widest uppercase">ตำแหน่งที่ {readingIndex + 1} / 10</p>
                <p className="text-yellow-400 font-bold text-lg">{POSITIONS[readingIndex].name}</p>
                <div className="flex items-center gap-2 mt-2 text-yellow-200 animate-pulse">
                  <Eye className="w-5 h-5" />
                  <span className="text-sm">แตะที่ไพ่บนกระดานเพื่อเปิดอ่าน</span>
                </div>
              </div>
            </div>
          )}

          {/* Reading (10 Cards) & Summary Panel */}
          {(gameState === 'summary' || (gameState === 'reading' && (revealed[readingIndex] || !isMobile))) && (
            <div className="w-full md:w-[45%] lg:w-[40%] bg-slate-900/95 md:bg-slate-900/85 backdrop-blur-xl border-t md:border-t-0 md:border-l border-indigo-500/40 p-5 md:p-8 h-full flex flex-col pointer-events-auto overflow-y-auto max-h-full shadow-2xl fade-in z-40 absolute right-0 top-0">

              {gameState === 'reading' && (
                <div className="flex-1 flex flex-col">
                  {isFallbackMode && <FallbackBadge />}

                  <div className="text-center mb-3">
                    <span className="inline-block px-2.5 py-0.5 bg-indigo-900/50 border border-indigo-500/30 rounded-full text-[10px] md:text-xs font-bold tracking-widest text-indigo-300 uppercase mb-1">
                      ใบที่ {readingIndex + 1} / 10
                    </span>
                    <h3 className="text-lg md:text-xl font-bold text-yellow-400">{POSITIONS[readingIndex].name}</h3>
                    <p className="text-xs md:text-sm text-indigo-200 mt-0.5">{POSITIONS[readingIndex].desc}</p>
                  </div>

                  {!revealed[readingIndex] ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-12 opacity-70 animate-pulse">
                      <Eye className="w-16 h-16 text-yellow-500 mb-4 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                      <p className="text-indigo-100 text-lg">คลิกไพ่ที่สว่างบนกระดานได้เลย</p>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col fade-in">
                      <div className="flex flex-col items-center mb-4">
                        <div className="relative group mb-3">
                          <div className="absolute inset-0 bg-yellow-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity rounded-xl"></div>
                          <div className="relative w-28 sm:w-32 md:w-36 aspect-[2/3] bg-slate-800 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] border-2 border-yellow-500/60 overflow-hidden flex flex-col items-center justify-center p-2 text-center">
                            <span className="text-yellow-500/50 text-sm font-bold z-0">{selectedCards[readingIndex].th}<br/>{selectedCards[readingIndex].name}</span>
                            <img
                              src={`https://wsrv.nl/?url=${selectedCards[readingIndex].img.replace('https://', '')}&w=320&output=webp&q=80&default=1`}
                              className="absolute inset-0 w-full h-full object-cover z-10 bg-white"
                              alt={selectedCards[readingIndex].th}
                              loading="lazy"
                              onError={(e) => e.target.style.display = 'none'}
                            />
                          </div>
                        </div>
                        <h4 className="text-xl font-bold text-white drop-shadow-md mb-0.5">{selectedCards[readingIndex].th}</h4>
                        <p className="text-xs text-yellow-300 italic mb-3">{selectedCards[readingIndex].name}</p>

                        <div className="w-full bg-indigo-900/40 border border-indigo-500/30 p-4 md:p-5 rounded-xl shadow-inner">
                          <ReadingBlock reading={aiReadings[readingIndex]} />
                        </div>
                      </div>

                      <div className="mt-auto pt-2 pb-28 md:pb-8">
                        <button
                          onClick={nextReading}
                          className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white hover:shadow-indigo-500/50"
                        >
                          {readingIndex < 9 ? "อ่านใบต่อไป" : "ดูบทสรุปเรื่องราว"}
                          <ArrowRight className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {gameState === 'summary' && (
                <div className="flex-1 flex flex-col fade-in">
                  {isFallbackMode && <FallbackBadge />}
                  <h3 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 mb-6 flex items-center justify-center gap-2 text-center mt-8">
                    <Sparkles className="w-6 h-6 text-yellow-400" /> บทสรุปของเรื่องนี้
                  </h3>

                  <div className="bg-black/40 border border-indigo-500/30 rounded-2xl p-6 mb-6 shadow-inner flex-1 text-indigo-100 text-base sm:text-lg leading-relaxed overflow-y-auto">
                    <p>{aiSummary}</p>
                  </div>

                  <div className="mt-auto flex flex-col gap-3 pb-28 md:pb-8">
                    <button
                      onClick={handleShowMutelu}
                      className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white animate-pulse"
                    >
                      <Sparkles className="w-5 h-5" />
                      รับทริคสายมู & เสริมดวง
                    </button>
                    <button
                      onClick={handlePrepareQuestion}
                      className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black"
                    >
                      <MessageCircleQuestion className="w-5 h-5" />
                      มีเรื่องคาใจ.. ถามคำถามเจาะจง (3 ใบ)
                    </button>
                    <button
                      onClick={handleReset}
                      className="w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors border border-slate-600 bg-slate-800/50 hover:bg-slate-700 text-slate-300"
                    >
                      จบการทำนาย (เริ่มทำนายใหม่ทั้งหมด)
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ถามคำถามเฉพาะเจาะจง */}
          {gameState === 'ask_question' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/60 backdrop-blur-md z-50 fade-in px-4">
              <div className="bg-slate-800 border border-yellow-500/50 p-6 md:p-8 rounded-3xl w-full max-w-xl shadow-2xl">
                <div className="flex items-center justify-center gap-3 mb-6 text-yellow-400">
                  <MessageCircleQuestion className="w-8 h-8" />
                  <h2 className="text-2xl font-bold">เลือกหมวดหมู่คำถาม</h2>
                </div>

                <div className="flex flex-wrap justify-center gap-3 mb-6">
                  {QUESTION_TOPICS.map(topic => (
                    <button
                      key={topic.id}
                      onClick={() => handleTopicSelect(topic.label)}
                      className={`px-4 py-2 rounded-full font-medium transition-all duration-300 ${selectedTopic === topic.label ? 'bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.5)] scale-105' : 'bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600'}`}
                    >
                      {topic.label}
                    </button>
                  ))}
                </div>

                <div className={`transition-all duration-500 overflow-hidden ${selectedTopic ? 'opacity-100 max-h-40' : 'opacity-40 pointer-events-none max-h-0 md:max-h-40'}`}>
                  <p className="text-indigo-200 mb-2 text-sm text-center">
                    มีคำถามเจาะจงเพิ่มเติมไหม? (พิมพ์หรือไม่พิมพ์ก็ได้)
                  </p>
                  <input
                    type="text"
                    value={customQuestion}
                    onChange={handleQuestionInput}
                    placeholder={`เช่น ปัญหาเรื่อง${selectedTopic ? selectedTopic.split(' ')[1] : '...'}จะดีขึ้นไหม?`}
                    className="w-full bg-slate-900 border border-indigo-500/50 text-white placeholder-slate-500 rounded-xl p-4 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 mb-6 transition-all text-center"
                  />
                </div>

                <div className="flex flex-col md:flex-row gap-3 mt-4">
                  <button
                    onClick={handleStartQuestionSpread}
                    disabled={!selectedTopic}
                    className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center transition-all ${selectedTopic ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'bg-slate-700 text-slate-400 cursor-not-allowed'}`}
                  >
                    สุ่มหยิบไพ่ 3 ใบ
                  </button>
                  <button
                    onClick={handleReset}
                    className="md:w-1/3 py-3 rounded-xl font-medium text-slate-300 hover:bg-slate-700 transition-all border border-slate-600"
                  >
                    กลับหน้าแรก
                  </button>
                </div>
              </div>
            </div>
          )}

          {gameState === 'spread_3' && (
            <div className="absolute top-6 md:top-8 left-1/2 -translate-x-1/2 w-[90%] max-w-md text-center pointer-events-auto fade-in z-50">
              <div className="inline-block bg-slate-800/90 backdrop-blur-md border border-yellow-500/50 px-6 py-3 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                <p className="text-yellow-400 font-medium text-base md:text-lg">
                  หยิบไพ่ไขคำตอบ {selectedCards.length} / 3 ใบ
                </p>
                <p className="text-indigo-200 text-xs md:text-sm mt-1">เรื่อง: {selectedTopic} {customQuestion && `(${customQuestion})`}</p>
              </div>
            </div>
          )}

          {/* 3-Card Reading Panel & Dream Reading (Bottom Area) */}
          {(gameState === 'reading_3' || gameState === 'reading_dream') && (
            <div className="absolute bottom-0 left-0 w-full bg-slate-900/95 backdrop-blur-xl border-t border-yellow-500/40 p-4 md:p-8 flex flex-col pointer-events-auto h-[70vh] md:h-[62vh] overflow-y-auto shadow-[0_-10px_40px_rgba(0,0,0,0.5)] fade-in z-40 pt-8">
              <div className="max-w-4xl mx-auto w-full flex flex-col h-full">

                <div className="text-center mb-4">
                  <h3 className="text-lg md:text-xl font-bold text-yellow-400 mb-1 border-b border-indigo-500/30 pb-2 inline-block">
                    {selectedTopic} {customQuestion && <span className="text-base text-yellow-200 font-normal ml-2">{customQuestion}</span>}
                  </h3>
                </div>

                <div className="flex-1 w-full bg-indigo-900/30 border border-indigo-500/30 p-4 md:p-6 rounded-2xl shadow-inner mb-5 overflow-y-auto">
                  {isFallbackMode && <FallbackBadge small />}
                  <ReadingBlock reading={questionAnswer} />
                </div>

                <div className="flex flex-col md:flex-row gap-3 mt-auto pb-28 md:pb-4">
                  <button
                    onClick={handleShowMutelu}
                    className="flex-1 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white animate-pulse"
                  >
                    <Sparkles className="w-5 h-5" />
                    รับคำแนะนำสายมูเฉพาะคุณ
                  </button>
                  <button
                    onClick={handlePrepareQuestion}
                    className="md:w-1/3 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors border border-indigo-500/50 bg-indigo-900/30 hover:bg-indigo-800 text-indigo-200"
                  >
                    <MessageCircleQuestion className="w-5 h-5" />
                    ถามเรื่องอื่นต่อ
                  </button>
                  <button
                    onClick={handleReset}
                    className="md:w-1/4 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    จบการทำนาย
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* Mutelu Reading Panel */}
          {gameState === 'reading_mutelu' && muteluTips && (
            <div className="absolute bottom-0 left-0 w-full bg-slate-900/98 backdrop-blur-2xl border-t-2 border-fuchsia-500/50 p-4 md:p-8 flex flex-col pointer-events-auto h-[75vh] md:h-[65vh] overflow-y-auto shadow-[0_-15px_50px_rgba(217,70,239,0.2)] fade-in z-50 pt-8 rounded-t-3xl">
              <div className="max-w-4xl mx-auto w-full flex flex-col h-full">

                <div className="text-center mb-6">
                  <h3 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-fuchsia-400 mb-2 inline-flex items-center gap-2">
                    <Moon className="w-6 h-6 text-fuchsia-400" />
                    คำแนะนำเสริมดวง (มูเตลู)
                    <Sun className="w-6 h-6 text-yellow-400" />
                  </h3>
                  <p className="text-indigo-200 text-sm">วิเคราะห์เจาะลึกจากพลังงานไพ่และสถานการณ์ของคุณโดยเฉพาะ</p>
                </div>

                <div className="flex-1 w-full space-y-4 mb-6 overflow-y-auto pr-2">
                  <div className="bg-indigo-900/20 border border-fuchsia-500/30 p-5 rounded-2xl shadow-inner text-left">
                    <h4 className="text-fuchsia-300 font-bold mb-2 flex items-center gap-2">
                      <Heart className="w-5 h-5" /> การทำบุญ / แก้เคล็ด
                    </h4>
                    <p className="text-indigo-100 text-base md:text-lg leading-relaxed">{muteluTips.make_merit}</p>
                  </div>

                  <div className="bg-indigo-900/20 border border-blue-500/30 p-5 rounded-2xl shadow-inner text-left">
                    <h4 className="text-blue-300 font-bold mb-2 flex items-center gap-2">
                      <Sparkles className="w-5 h-5" /> ไอเทม & สีมงคล
                    </h4>
                    <p className="text-indigo-100 text-base md:text-lg leading-relaxed">{muteluTips.lucky_item}</p>
                  </div>

                  <div className="bg-indigo-900/20 border border-yellow-500/30 p-5 rounded-2xl shadow-inner text-left">
                    <h4 className="text-yellow-400 font-bold mb-2 flex items-center gap-2">
                      <Star className="w-5 h-5" /> เลขมงคลจากหน้าไพ่
                    </h4>
                    <p className="text-indigo-100 text-base md:text-lg leading-relaxed">{muteluTips.lucky_number}</p>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-3 mt-auto pb-28 md:pb-6">
                  <button
                    onClick={handleBackFromMutelu}
                    className="flex-1 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors border border-fuchsia-500/50 bg-fuchsia-900/20 hover:bg-fuchsia-900/40 text-fuchsia-200"
                  >
                    กลับไปดูคำทำนายเดิม
                  </button>
                  <button
                    onClick={handleReset}
                    className="md:w-1/4 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    จบการทำนาย
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>
      </main>

    </div>
  );
}
