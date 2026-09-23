-- ============================================================
-- Mock tickets for the admin dashboard (demo data)
-- Paste into Supabase Dashboard → SQL Editor → Run, after migration.sql.
--
-- Creates ~700 tickets spread over the last 120 days across the six
-- default systems: more on weekdays and office hours, a gently rising
-- trend, and statuses that depend on age (new ones pending, old ones
-- mostly resolved, a few left stuck so "ค้างนานที่สุด" has content).
--
-- Safe to re-run: mock rows use fixed ids (md5 of 'mock-ticket-N'), so
-- each run deletes the previous batch and inserts a fresh one with
-- dates relative to today. Real tickets are never touched.
--
-- To remove all mock data, run only the "delete" statement below.
-- ============================================================

-- make sure the six default systems exist (same rows as migration.sql)
insert into public.systems (name, slug, description, icon_color, is_active, audience)
values
  ('ระบบ E-Document', 'e-document', 'แจ้งปัญหาการรับ-ส่งหนังสือราชการ ลงนาม หรือแนบไฟล์เอกสาร', '#2563EB', true, 'staff'),
  ('ระบบขอใช้รถมหาวิทยาลัย', 'vehicle-booking', 'แจ้งปัญหาการจองรถ การอนุมัติคำขอ หรือข้อมูลรถ/คนขับ', '#D97757', true, 'staff'),
  ('ระบบวีซ่า', 'visa', 'แจ้งปัญหาการยื่นคำขอวีซ่า อัปโหลดเอกสาร หรือสถานะคำขอ', '#7C3AED', true, 'student'),
  ('ระบบทะเบียนนักศึกษา', 'student-registry', 'แจ้งปัญหาการลงทะเบียนเรียน ผลการเรียน หรือข้อมูลนักศึกษา', '#0F6C61', true, 'student'),
  ('ระบบจองห้อง', 'room-booking', 'แจ้งปัญหาการจองห้องเรียน ห้องประชุม หรือตารางการใช้ห้อง', '#D97757', true, 'staff'),
  ('App NES', 'app-nes', 'แจ้งปัญหาการใช้งานแอปพลิเคชัน NES บนมือถือ', '#2563EB', true, 'student')
on conflict (slug) do nothing;

-- remove the previous mock batch
delete from public.tickets
where id in (select md5('mock-ticket-' || g)::uuid from generate_series(1, 2000) g);

with gen as (
  select
    g,
    random() as r_sys,
    random() as r_msg,
    -- skew toward recent days so the trend rises: age = 120 * r^1.35
    floor(120 * power(random(), 1.35))::int as age_days,
    -- office hours 08:00–17:59, a few in the evening
    case when random() < 0.88 then 8 + floor(random() * 10) else 18 + floor(random() * 5) end as hour,
    floor(random() * 60) as minute,
    random() as r_weekend,
    floor(random() * 5)::int as shift_days,
    random() as r_status,
    random() as r_fix
  from generate_series(1, 700) g
),
placed as (
  select
    g,
    case
      when r_sys < 0.26 then 'student-registry'
      when r_sys < 0.46 then 'e-document'
      when r_sys < 0.60 then 'room-booking'
      when r_sys < 0.74 then 'vehicle-booking'
      when r_sys < 0.88 then 'app-nes'
      else 'visa'
    end as slug,
    r_msg, r_weekend, shift_days, r_status, r_fix,
    date_trunc('day', now()) - make_interval(days => age_days)
      + make_interval(hours => hour::int, mins => minute::int) as ts
  from gen
),
weekday as (
  -- most weekend reports move back onto a random weekday (Mon–Fri)
  select
    *,
    least(
      case
        when extract(isodow from ts) = 6 and r_weekend < 0.7 then ts - make_interval(days => 1 + shift_days)
        when extract(isodow from ts) = 7 and r_weekend < 0.7 then ts - make_interval(days => 2 + shift_days)
        else ts
      end,
      now() - interval '10 minutes'
    ) as created_at
  from placed
),
msgs(slug, list) as (
  values
    ('student-registry', array[
      'ลงทะเบียนเรียนไม่ได้ ระบบแจ้งว่าวิชาเต็มทั้งที่ยังมีที่ว่าง',
      'หน้าผลการเรียนแสดงเกรดไม่ครบทุกวิชา',
      'เพิ่ม-ถอนรายวิชาแล้วสถานะไม่อัปเดต',
      'พิมพ์ใบแจ้งหนี้ค่าลงทะเบียนไม่ได้ ขึ้นหน้าขาว',
      'ข้อมูลที่อยู่ของนักศึกษาแก้ไขแล้วไม่บันทึก',
      'ขอใบรับรองการเป็นนักศึกษาแล้วไม่ได้รับไฟล์',
      'ระบบช้ามากช่วงเปิดลงทะเบียน กดแล้วหมุนค้าง',
      'รายชื่ออาจารย์ที่ปรึกษาไม่ถูกต้อง',
      'ตารางเรียนแสดงห้องเรียนผิด',
      'เข้าสู่ระบบด้วยรหัสนักศึกษาไม่ได้หลังเปลี่ยนรหัสผ่าน'
    ]),
    ('e-document', array[
      'แนบไฟล์ PDF เกิน 10MB ไม่ได้ ขึ้น error',
      'ส่งหนังสือเวียนแล้วผู้รับไม่ได้รับแจ้งเตือน',
      'ลงนามอิเล็กทรอนิกส์ไม่ผ่าน ใบรับรองหมดอายุ',
      'ค้นหาเลขที่หนังสือย้อนหลังไม่เจอ',
      'เลขทะเบียนรับหนังสือซ้ำกัน',
      'เปิดไฟล์แนบแล้วภาษาไทยเป็นตัวอักษรแปลก',
      'มอบหมายงานต่อให้คนอื่นไม่ได้ ปุ่มกดไม่ติด',
      'สถานะหนังสือค้างที่รอลงนามทั้งที่ลงนามแล้ว',
      'พิมพ์ใบปะหน้าหนังสือแล้วหัวกระดาษเพี้ยน'
    ]),
    ('vehicle-booking', array[
      'จองรถแล้วไม่ได้รับอีเมลยืนยัน',
      'คำขอใช้รถค้างสถานะรออนุมัติหลายวัน',
      'ปฏิทินรถว่างแสดงไม่ตรงกับความจริง',
      'เลือกคนขับไม่ได้ รายชื่อว่าง',
      'แก้ไขวันเดินทางหลังส่งคำขอไม่ได้',
      'ยกเลิกการจองแล้วระบบยังแสดงว่าจองอยู่',
      'คำนวณระยะทางและค่าน้ำมันผิด',
      'ผู้อนุมัติกดอนุมัติแล้วขึ้น error 500'
    ]),
    ('visa', array[
      'อัปโหลดสำเนาพาสปอร์ตไม่ได้ ไฟล์ JPG ถูกปฏิเสธ',
      'สถานะคำขอวีซ่าไม่เปลี่ยนมาหลายสัปดาห์',
      'แบบฟอร์มขอหนังสือรับรองวีซ่าบันทึกไม่ได้',
      'ไม่ได้รับอีเมลแจ้งนัดหมายรับเอกสาร',
      'ข้อมูลวันหมดอายุวีซ่าแสดงผิด',
      'ต่ออายุวีซ่านักศึกษาแล้วระบบยังแจ้งเตือนว่าหมดอายุ',
      'ดาวน์โหลดหนังสือรับรองแล้วไฟล์เสีย'
    ]),
    ('room-booking', array[
      'จองห้องประชุมแล้วระบบแจ้งว่าห้องไม่ว่าง ทั้งที่ปฏิทินว่าง',
      'จองห้องซ้อนเวลากับคนอื่นได้ ระบบไม่เตือน',
      'ยกเลิกการจองห้องไม่ได้ ปุ่มยกเลิกกดไม่ติด',
      'ไม่ได้รับอีเมลยืนยันการจองห้อง',
      'ตารางการใช้ห้องแสดงเวลาเลื่อนไป 7 ชั่วโมง',
      'ค้นหาห้องตามจำนวนที่นั่งแล้วผลลัพธ์ไม่ถูกต้อง',
      'ผู้อนุมัติไม่เห็นคำขอจองห้องในรายการรออนุมัติ'
    ]),
    ('app-nes', array[
      'เปิดแอป NES แล้วเด้งออกทันที (iOS)',
      'เข้าสู่ระบบในแอปไม่ได้ ขึ้นว่า token หมดอายุ',
      'ไม่ได้รับการแจ้งเตือน push notification',
      'หน้าตารางเรียนในแอปโหลดไม่ขึ้น หมุนค้าง',
      'สแกน QR เช็กชื่อในแอปแล้วขึ้น error',
      'แอปแสดงข้อมูลไม่ตรงกับหน้าเว็บ',
      'อัปเดตแอปเวอร์ชันล่าสุดแล้วเข้าใช้งานไม่ได้ (Android)'
    ])
),
shaped as (
  select
    w.g,
    s.id as system_id,
    m.list[1 + floor(w.r_msg * array_length(m.list, 1))::int] as message,
    w.created_at,
    extract(epoch from now() - w.created_at) / 86400 as age,
    w.r_status,
    w.r_fix
  from weekday w
  join public.systems s on s.slug = w.slug
  join msgs m on m.slug = w.slug
),
statused as (
  select
    *,
    case
      when age < 1 then case when r_status < 0.80 then 'pending' else 'in_progress' end
      when age < 5 then case when r_status < 0.35 then 'pending' when r_status < 0.70 then 'in_progress' else 'resolved' end
      when age < 14 then case when r_status < 0.10 then 'pending' when r_status < 0.28 then 'in_progress' else 'resolved' end
      else case when r_status < 0.025 then 'pending' when r_status < 0.06 then 'in_progress' else 'resolved' end
    end as status
  from shaped
)
insert into public.tickets (id, system_id, reporter_id, message, status, created_at, updated_at)
select
  md5('mock-ticket-' || g)::uuid,
  system_id,
  null,
  message,
  status,
  created_at,
  case
    when status = 'resolved' then least(now(), created_at + make_interval(hours => (4 + floor(r_fix * 92))::int))
    when status = 'in_progress' then least(now(), created_at + make_interval(hours => (1 + floor(r_fix * 20))::int))
    else created_at
  end
from statused;

-- quick check: tickets per system and status
select s.name, t.status, count(*)
from public.tickets t
join public.systems s on s.id = t.system_id
where t.id in (select md5('mock-ticket-' || g)::uuid from generate_series(1, 2000) g)
group by 1, 2
order by 1, 2;
