// One-time template additions from the UHV documents (Oct 2026):
//  - Team: "Staff Representatives" and "Student Representatives" groups (official member list AY 2025–26)
//  - About: "Implementation Journey" section (Principal's address, Implementation Journey report, AICTE recognition)
// Editable parts carry explicit keys. Safe to re-run: skipped when already added.
import { readFileSync, writeFileSync } from "node:fs";

const card = (icon, name, pill, role, i) => `
      <div class="member-card" data-aos="fade-up" data-delay="${i * 50}">
        <div class="member-avatar">${icon}</div>
        <div class="member-name">${name}</div>
        <div class="member-dept">${pill}</div>
        <div class="member-role">${role}</div>
      </div>`;
const group = (key, tag, icon, title, desc, tagKey, list) => `
    <!-- ${title.replace(/<[^>]+>/g, "")} -->
    <div class="section-header" data-aos="fade-up" style="margin-bottom:28px;margin-top:48px">
      <span data-e="t:team.${tagKey}a" class="section-tag"><i class="fas ${icon}"></i> ${tag}</span>
      <h2 data-e="t:team.${tagKey}b" class="section-title">${title}</h2>
      <div class="divider"></div>
      <p data-e="t:team.${tagKey}c" class="section-desc">${desc}</p>
    </div>

    <div data-list="list:team.${key}" data-tpl="member" data-label="${tag}" class="member-grid">${list.map((m, i) => card(...m, i)).join("")}
    </div>
`;

let team = readFileSync("templates/team.html", "utf8");
if (!team.includes('data-list="list:team.staff"')) {
  const staff = [
    ["🧑‍🔧", "Mr. Ateeq Ahmed M", "CSE", "Lab Assistant – CSE Dept.<br/>Staff Representative"],
    ["🗂️", "Mr. M Mansoor Basha", "Office", "Office Superintendent<br/>Staff Representative"],
    ["🏢", "Mr. Mohammed Jameel", "Facilities", "Facilities Manager<br/>Staff Representative"],
    ["🛡️", "Mrs. Rathna Shanabag", "Security", "Security Staff<br/>Staff Representative"],
    ["🧹", "Mrs. I Banu", "Housekeeping", "Cleaning Staff<br/>Staff Representative"],
  ];
  const students = [
    ["🎓", "Mr. Mohammed Husanine", "CSE", "4th Year – CSE Dept.<br/>Student Representative"],
    ["🎓", "Miss Raziba Aziz", "ISE", "4th Year – ISE Dept.<br/>Student Representative"],
    ["🎓", "Mr. Hanzala Jawwad", "AIML", "3rd Year – AIML Dept.<br/>Student Representative"],
    ["🎓", "Mr. Nadeem Akthar", "AIML", "3rd Year – AIML Dept.<br/>Student Representative"],
    ["🎓", "Miss Vaishnavi N", "ECE", "2nd Year – ECE Dept.<br/>Student Representative"],
  ];
  const block =
    group("staff", "Staff", "fa-people-carry-box", "Staff <span>Representatives</span>",
      "Members of the administrative and support staff who carry the UHV spirit across the campus.", "s1", staff) +
    group("students", "Students", "fa-user-graduate", "Student <span>Representatives</span>",
      "Student representatives from every year who bring the voice of learners to the UHV Cell.", "s2", students);
  team = team.replace("    <!-- Join the team -->", block + "\n    <!-- Join the team -->");
  writeFileSync("templates/team.html", team);
  console.log("team.html: staff and student groups added");
}

let about = readFileSync("templates/about.html", "utf8");
if (!about.includes("t:about.j1")) {
  const milestone = (n, icon, title, text, delay) => `
      <div class="obj-card" data-aos="fade-up" data-delay="${delay}">
        <div data-e="t:about.jm${n}i" class="obj-icon">${icon}</div>
        <h4 data-e="t:about.jm${n}t">${title}</h4>
        <p data-e="t:about.jm${n}p">${text}</p>
      </div>`;
  const harmony = (n, icon, title, text) => `
      <li>
        <div data-e="t:about.jh${n}i" class="f-icon">${icon}</div>
        <div>
          <h5 data-e="t:about.jh${n}t">${title}</h5>
          <p data-e="t:about.jh${n}p">${text}</p>
        </div>
      </li>`;
  const section = `
<!-- Implementation Journey -->
<section class="section section-alt">
  <div class="container">
    <div class="section-header" data-aos="fade-up">
      <span data-e="t:about.j1" class="section-tag"><i class="fas fa-route"></i> Our Journey</span>
      <h2 data-e="t:about.j2" class="section-title">Implementation <span>Journey</span></h2>
      <div class="divider"></div>
      <p data-e="t:about.j3" class="section-desc">How Universal Human Values grew from faculty transformation into a value-driven academic ecosystem at HKBKCE.</p>
    </div>

    <div class="vision-mission-grid" data-aos="fade-up" data-delay="100" style="margin-bottom:40px">
      <div class="vm-card vision">
        <div data-e="t:about.j4" class="vm-label"><i class="fas fa-quote-left"></i> Principal's Message</div>
        <h3 data-e="t:about.j5">Competence with Character</h3>
        <p data-e="t:about.j6">"At HKBK College of Engineering, Universal Human Values is not merely a curriculum requirement; it is a reflection of our institutional philosophy. Its true success lies in the transformation of people — students becoming responsible citizens, teachers becoming compassionate mentors, and institutions becoming centres of harmony and ethical excellence." <br/><strong>— Dr. Mohammed Riyaz Ahmed, Principal</strong></p>
      </div>
      <div class="vm-card mission">
        <div data-e="t:about.j7" class="vm-label"><i class="fas fa-compass"></i> Looking Ahead · 2026–27</div>
        <h3 data-e="t:about.j8">Mentoring &amp; AI Ethics</h3>
        <p data-e="t:about.j9">From the 2026–27 academic year, every student is supported by a <strong>UHV-Based Holistic Mentoring Framework</strong> spanning the First to the Eighth Semester. As HKBKCE becomes an AI Campus, a <strong>UHV-Based AI Ethics Framework</strong> guides students, faculty and staff to use AI with right understanding, right intention and the right perspective.</p>
      </div>
    </div>

    <div class="objectives-grid">${[
      ["🎓", "First AICTE FDP · May 2024", "A three-day face-to-face FDP on UHV (Introductory) with AICTE NCC-IP — the first activity of the UHV Cell, with 53 participants.", 0],
      ["👩‍🏫", "50+ Certified Faculty", "More than fifty faculty members are AICTE-certified in Universal Human Values through Introductory, Refresher and UHV-II programmes.", 60],
      ["🏛️", "Potential Nodal Centre · 2025–27", "Recognised by AICTE as a Potential Nodal Centre for Universal Human Values for 2025–27 (letter dated 13 December 2025).", 120],
      ["🌿", "UHV-II FDP · July 2026", "A five-day AICTE face-to-face FDP on UHV-II (21–25 July 2026) led by the AICTE NCC-IP team, preparing faculty as UHV mentors.", 180],
      ["📘", "In the Curriculum", "UHV is introduced in the Student Induction Programme and taught as a one-credit course for all branches up to the fourth semester.", 240],
      ["📜", "Values in Research", "Papers on the Gita and on the Acharya–Shishya relationship were presented at the International Conference on Bharatiya Gnana Parampara, NITTE.", 300],
    ].map(([i, t, p, d], n) => milestone(n + 1, i, t, p, d)).join("")}
    </div>

    <div class="section-header" data-aos="fade-up" style="margin-top:56px">
      <h2 data-e="t:about.j10" class="section-title">Harmony <span>in Action</span></h2>
      <div class="divider"></div>
      <p data-e="t:about.j11" class="section-desc">Activities at HKBKCE that bring the four levels of harmony to life.</p>
    </div>
    <ul class="framework-list" data-aos="fade-up" data-delay="100">${[
      ["🧘", "Harmony in Self", "Self-regulation, health and right understanding — Nasha Mukt Bharat Pakhwada, healthy-lifestyle initiatives, oil and sugar awareness boards and UHV lectures."],
      ["👨‍👩‍👦", "Harmony in Family", "Trust, respect, affection, care and gratitude — the Mass Marriage Initiative, Gender Sensitization and POSH workshop, and appreciation of support staff."],
      ["🏘️", "Harmony in Society", "Justice, equality, inclusion and compassion — Anti-Ragging Week, Constitution Day, Human Rights Day, National Voters Day, blood donation and SC/ST awareness."],
      ["🌏", "Harmony in Nature", "Coexistence and sustainable living — World Environment Day, campus plantation, Mission LiFE initiatives and environment-oriented student projects."],
    ].map(([i, t, p], n) => harmony(n + 1, i, t, p)).join("")}
    </ul>
  </div>
</section>
`;
  const at = about.indexOf("<footer");
  about = about.slice(0, at) + section.trimStart() + "\n" + about.slice(at);
  writeFileSync("templates/about.html", about);
  console.log("about.html: Implementation Journey section added");
}
