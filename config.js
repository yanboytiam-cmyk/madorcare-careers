/* ---------------------------------------------------------------------------
   MaDorCARE — Careers application
   Config: brand tokens, open roles, and the question flow.
   Everything the client might want changed lives in this one file.
--------------------------------------------------------------------------- */

const BRAND = {
  name: 'MaDorCARE',
  tagline: 'Empowering you to Thrive',
  intro: 'We are hiring across our Dallas-Fort Worth care teams.',
  city: 'Fort Worth',
  state: 'Texas',
  address: '1201 Bessie Street, Fort Worth, TX 76104',
  email: 'info@madorcare.com',
  phone: '1-203-823-7086',
  website: 'https://www.madorcare.com',
  logo: 'assets/madorcare-logo.png',
};

/* Palette lifted from the logo and the hiring flyer.
   navy + forest→lime sweep are the brand's two load-bearing marks.  */
const COLORS = {
  navy:    '#16305C',
  forest:  '#0E3F24',
  green:   '#2C9B4B',
  lime:    '#93D64F',
  teal:    '#3FAECB',
  brick:   '#BE3A2B',
  canvas:  '#F3F6F4',
  surface: '#FFFFFF',
  line:    '#DDE5E0',
  inkSoft: '#5A6B72',
};

/* --- Open roles ------------------------------------------------------------
   Straight off the flyer. `credentials` drives the licence question,
   `extras` are the questions only this role sees.
--------------------------------------------------------------------------- */

const ROLES = [
  {
    id: 'therapist',
    label: 'Therapist',
    blurb: 'Individual and group behavioral health therapy.',
    credentials: [
      'LPC — Licensed Professional Counselor',
      'LPC-Associate',
      'LCSW — Licensed Clinical Social Worker',
      'LMSW — Licensed Master Social Worker',
      'LMFT — Licensed Marriage and Family Therapist',
      'LMFT-Associate',
      'Licensed Psychologist',
      'My licence is still pending',
    ],
    extras: [
      {
        id: 'modalities',
        type: 'checkbox',
        section: 'The role',
        title: 'Which approaches do you practise?',
        help: 'Choose every one you use regularly.',
        options: ['CBT', 'DBT', 'EMDR', 'Trauma-informed care', 'Family systems', 'Psychodynamic', 'Motivational interviewing', 'Play therapy'],
        required: true,
      },
      {
        id: 'populations',
        type: 'checkbox',
        section: 'The role',
        title: 'Which groups have you worked with?',
        options: ['Children', 'Adolescents', 'Adults', 'Older adults', 'Couples', 'Families'],
        required: true,
      },
      {
        id: 'telehealth',
        type: 'radio',
        section: 'The role',
        title: 'Have you delivered therapy over telehealth?',
        options: ['Yes, regularly', 'Yes, occasionally', 'Not yet'],
        required: true,
        autoAdvance: true,
      },
    ],
  },
  {
    id: 'case_manager',
    label: 'Targeted Case Manager',
    blurb: 'Coordinating care, referrals, and follow-up in the community.',
    credentials: null,
    extras: [
      {
        id: 'tcm_degree',
        type: 'radio',
        section: 'The role',
        title: 'What is your highest degree?',
        help: 'Texas targeted case management requires a bachelor’s degree in a human services field.',
        options: [
          'Bachelor’s in a human services field',
          'Bachelor’s in another field',
          'Master’s in a human services field',
          'Master’s in another field',
          'Associate degree or high school diploma',
        ],
        required: true,
        autoAdvance: true,
      },
      {
        id: 'tcm_caseload',
        type: 'radio',
        section: 'The role',
        title: 'What is the largest caseload you have carried?',
        options: ['Under 20 clients', '20 to 40 clients', '40 to 60 clients', 'More than 60 clients', 'I have not carried a caseload yet'],
        required: true,
        autoAdvance: true,
      },
      {
        id: 'tcm_transport',
        type: 'radio',
        section: 'The role',
        title: 'Do you have a valid driver’s licence and reliable transportation?',
        help: 'This role visits clients in the community.',
        options: ['Yes, both', 'Licence yes, transportation no', 'Neither'],
        required: true,
        autoAdvance: true,
      },
    ],
  },
  {
    id: 'nurse_practitioner',
    label: 'Nurse Practitioner',
    blurb: 'Psychiatric evaluation, diagnosis, and medication management.',
    credentials: [
      'APRN, PMHNP-BC (psychiatric certified)',
      'APRN, certified in another specialty',
      'RN, currently in an NP programme',
      'My licence is still pending',
    ],
    extras: [
      {
        id: 'np_prescribing',
        type: 'radio',
        section: 'The role',
        title: 'Do you hold current prescriptive authority in Texas?',
        options: ['Yes, with a DEA number', 'Yes, without a DEA number', 'No', 'Application in progress'],
        required: true,
        autoAdvance: true,
      },
      {
        id: 'np_settings',
        type: 'checkbox',
        section: 'The role',
        title: 'Where have you practised?',
        options: ['Outpatient behavioral health', 'Inpatient psychiatric', 'Primary care', 'Telepsychiatry', 'Substance use treatment', 'Crisis or emergency'],
        required: true,
      },
    ],
  },
];

/* --- Question flow ---------------------------------------------------------
   Screens appear in this order. Role `extras` are injected right after the
   role question. `when` keeps a question hidden until its condition is true.
--------------------------------------------------------------------------- */

const FLOW = [
  {
    id: 'role',
    type: 'select',
    section: 'The role',
    title: 'Which role are you applying for?',
    help: 'One application per role. Come back and apply again if more than one fits you.',
    options: ROLES.map(r => ({ value: r.id, label: r.label, note: r.blurb })),
    required: true,
    autoAdvance: true,
    echo: a => {
      const r = roleOf(a);
      return r ? `The rest of these questions are set for the ${r.label} role.` : null;
    },
  },

  /* --- Credentials --- */
  {
    id: 'credential_type',
    type: 'select',
    section: 'Credentials',
    title: 'Which licence do you hold?',
    required: true,
    autoAdvance: true,
    when: a => Boolean(roleOf(a) && roleOf(a).credentials),
    optionsFor: a => roleOf(a).credentials.map(c => ({ value: c, label: c })),
  },
  {
    id: 'credential_number',
    type: 'text',
    section: 'Credentials',
    title: 'What is your licence number?',
    help: 'We verify this before making an offer.',
    required: true,
    when: a => Boolean(a.credential_type) && !String(a.credential_type).includes('pending'),
  },
  {
    id: 'licence_texas',
    type: 'radio',
    section: 'Credentials',
    title: 'Are you licensed to practise in Texas?',
    options: ['Yes', 'Not yet, but I am eligible', 'No'],
    required: true,
    autoAdvance: true,
    when: a => Boolean(roleOf(a) && roleOf(a).credentials),
  },

  /* --- Experience --- */
  {
    id: 'experienced',
    type: 'radio',
    section: 'Your experience',
    title: 'Have you worked in this kind of role before?',
    options: ['Yes', 'No, this would be my first'],
    required: true,
    autoAdvance: true,
    echo: a => a.experienced === 'No, this would be my first'
      ? 'Noted. Tell us about the path that brought you here and we will read it properly.'
      : null,
  },
  {
    id: 'years',
    type: 'number',
    section: 'Your experience',
    title: 'How many years of experience do you have?',
    placeholder: 'e.g. 4',
    min: 0, max: 50,
    required: true,
    when: a => a.experienced === 'Yes',
  },
  {
    id: 'last_role',
    type: 'text',
    section: 'Your experience',
    title: 'What is your most recent role, and where?',
    placeholder: 'e.g. Therapist at Riverside Counseling, Fort Worth',
    required: true,
    when: a => a.experienced === 'Yes',
  },
  {
    id: 'motivation',
    type: 'textarea',
    section: 'Your experience',
    title: 'Why this work, and why MaDorCARE?',
    help: 'A few honest sentences. Someone here reads every one.',
    required: true,
    maxLength: 900,
  },

  /* --- About you --- */
  {
    id: 'name',
    type: 'text',
    section: 'About you',
    title: 'What is your full name?',
    placeholder: 'First and last name',
    required: true,
    echo: a => (a.name && a.name.trim().length > 1)
      ? `Good to meet you, ${a.name.trim().split(/\s+/)[0]}.`
      : null,
  },
  {
    id: 'email',
    type: 'email',
    section: 'About you',
    title: 'What is your email address?',
    help: 'Our reply lands here, so check the spelling.',
    placeholder: 'you@example.com',
    required: true,
  },
  {
    id: 'phone',
    type: 'tel',
    section: 'About you',
    title: 'What is your phone number?',
    placeholder: '(214) 555-0123',
    required: true,
  },
  {
    id: 'city',
    type: 'text',
    section: 'About you',
    title: 'Which city do you live in?',
    placeholder: 'e.g. Fort Worth',
    required: true,
  },
  {
    id: 'commute',
    type: 'radio',
    section: 'About you',
    title: 'Can you get to our Fort Worth office for on-site work?',
    options: ['Yes, I am local', 'Yes, I would commute', 'I would need to relocate', 'I am looking for remote only'],
    required: true,
    autoAdvance: true,
  },
  {
    id: 'work_auth',
    type: 'radio',
    section: 'About you',
    title: 'Are you authorized to work in the United States?',
    options: ['Yes', 'Yes, but I will need sponsorship later', 'No'],
    required: true,
    autoAdvance: true,
  },
  {
    id: 'languages',
    type: 'checkbox',
    section: 'About you',
    title: 'Which languages can you counsel in?',
    help: 'Spanish is in high demand across our Dallas-Fort Worth caseload.',
    options: ['English', 'Spanish', 'French', 'Vietnamese', 'American Sign Language', 'Other'],
    required: true,
  },

  /* --- Practical --- */
  {
    id: 'schedule',
    type: 'radio',
    section: 'Practical',
    title: 'What schedule are you looking for?',
    options: ['Full-time', 'Part-time', 'PRN or contract', 'Either works'],
    required: true,
    autoAdvance: true,
  },
  {
    id: 'start',
    type: 'radio',
    section: 'Practical',
    title: 'When could you start?',
    options: ['Right away', 'Within two weeks', 'Within a month', 'More than a month from now'],
    required: true,
    autoAdvance: true,
  },
  {
    id: 'salary',
    type: 'text',
    section: 'Practical',
    title: 'What are your salary expectations?',
    help: 'A range is fine. Say hourly or yearly so we compare like for like.',
    placeholder: 'e.g. $75,000 a year, or $45 an hour',
    required: true,
  },
  {
    id: 'cv',
    type: 'file',
    section: 'Practical',
    title: 'Attach your resume',
    help: 'PDF or Word, up to 5 MB.',
    accept: '.pdf,.doc,.docx',
    maxMB: 5,
    required: true,
  },
  {
    id: 'notes',
    type: 'textarea',
    section: 'Practical',
    title: 'Anything else we should know?',
    help: 'Optional. Certifications, a gap you want to explain, questions for us.',
    required: false,
    maxLength: 900,
  },
];

function roleOf(answers) {
  return ROLES.find(r => r.id === answers.role) || null;
}

/* n8n workflow "MaDorCARE - candidatures": writes the row to Google Sheets,
   files the resume in Drive, and answers with the reference number.
   A failure there triggers "MaDorCARE - alerte erreur", which emails Yanis. */
const ENDPOINT = 'https://n8n.srv1325858.hstgr.cloud/webhook/madorcare-candidature';
