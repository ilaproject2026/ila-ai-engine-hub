/**
 * Global Authorized Curriculum & Source Linking Engine
 * Benchmarks courses against recognized national & international standard bodies/frameworks
 * (CEFR, SAP SE, Python Software Foundation, DMI, Meta, IEEE, ISO/IEC, AWS, PMI, IFRS, WHO, etc.)
 */

export interface StandardReferenceLink {
  title: string;
  url: string;
  description: string;
  isOpenAccess: boolean;
  approvalNature?: string; // e.g. "Official Open-Access Standard", "Authorized Syllabus Blueprint"
}

export interface OpenSourceResource {
  name: string;
  type: 'Textbook / OER' | 'Official Spec' | 'Interactive Sandbox' | 'Code Repository' | 'Dataset' | 'Lecture Notes';
  url: string;
  provider: string;
  description: string;
  accessLevel: '100% Free Open Access' | 'Public Standard' | 'Permissive License (MIT/Apache/CC)';
}

export interface OfficialExamPassCriteria {
  minPassingScore: string; // e.g. "70% (Scaled Score 700/1000)" or "60 points out of 100"
  examFormat: string; // e.g. "60-80 Multiple Choice & Scenario-based Practical Labs"
  timeLimit: string; // e.g. "90 - 120 Minutes"
  competencyDomains: Array<{ name: string; weight: string; description?: string }>;
  certificationTitle: string; // e.g. "Official Certified Practitioner / CEFR Certification"
  preRequisites: string; // e.g. "Foundational domain coursework or relevant practical experience"
  retakePolicy?: string;
}

export interface StandardBodyInfo {
  domain: string;
  bodyName: string;
  frameworkName: string;
  levelOrCode: string;
  badge: string;
  badgeColor: string;
  governingAuthority: string;
  approvalNature: string; // e.g. "Council of Europe Treaty Standard", "Enterprise Vendor Authorized", "Open-Access International Standard"
  description: string;
  standardStructure: string[];
  referenceLinks: StandardReferenceLink[];
  openSourceResources?: OpenSourceResource[];
  examPassCriteria?: OfficialExamPassCriteria;
}

/**
 * Comprehensive standard frameworks database for recognized global subjects
 */
const STANDARD_FRAMEWORKS: Record<string, StandardBodyInfo> = {
  german: {
    domain: 'German Language & European Linguistics',
    bodyName: 'Council of Europe & Goethe-Institut',
    frameworkName: 'CEFR (Common European Framework of Reference for Languages)',
    levelOrCode: 'CEFR Levels A1, A2, B1, B2, C1, C2',
    badge: 'CEFR Authorized',
    badgeColor: '#eab308',
    governingAuthority: 'Council of Europe (Strasbourg) & Goethe-Institut e.V.',
    approvalNature: 'International Intergovernmental Standard & Official Open-Access Framework',
    description: 'International benchmark for grading foreign language proficiency across communicative competence, grammar syntax, and cultural fluency.',
    standardStructure: [
      'Level A1 (Breakthrough): Everyday basic expressions, personal introductions, survival vocabulary',
      'Level A2 (Waystage): Routine communication, simple information exchange, background descriptions',
      'Level B1 (Threshold): Independent conversation, travel scenarios, expressing opinions and plans',
      'Level B2 (Vantage): Complex technical text comprehension, spontaneous native-like interaction',
      'Level C1 (Effective Operational): Demanding longer texts, flexible professional discourse and synthesis',
      'Level C2 (Mastery): Spontaneous precise expression, nuanced native-grade fluency and idioms',
    ],
    referenceLinks: [
      {
        title: 'Council of Europe - CEFR Official Framework Portal',
        url: 'https://www.coe.int/en/web/common-european-framework-reference-languages',
        description: 'Official global standard descriptors, Can-Do statements, and competence scales.',
        isOpenAccess: true,
        approvalNature: 'Intergovernmental Treaty Reference',
      },
      {
        title: 'Goethe-Institut Examination & Syllabus Framework',
        url: 'https://www.goethe.de/en/spr/kup/prf.html',
        description: 'Authorized worldwide German curriculum and certification criteria.',
        isOpenAccess: true,
        approvalNature: 'Authorized Examination Authority',
      },
      {
        title: 'Deutsche Welle Open Educational Language Resources',
        url: 'https://learngerman.dw.com/',
        description: 'Open-access German instructional courses aligned with CEFR standards.',
        isOpenAccess: true,
        approvalNature: 'Open Educational Resource (OER)',
      },
    ],
  },

  sap: {
    domain: 'Enterprise Resource Planning & Business Systems',
    bodyName: 'SAP SE Global Certification Framework',
    frameworkName: 'SAP S/4HANA & SAP Activate Methodology',
    levelOrCode: 'SAP Certified Associate / Specialist (C_TS452 / C_TS4FI / C_ACTIVATE)',
    badge: 'SAP Authorized Framework',
    badgeColor: '#0284c7',
    governingAuthority: 'SAP SE (Walldorf, Germany)',
    approvalNature: 'Official Enterprise Software Vendor Accreditation & Learning Journey Standard',
    description: 'Standardized enterprise business process architectures, transaction hierarchies, and implementation guidelines benchmarked to official SAP learning journeys.',
    standardStructure: [
      'Enterprise Organizational Structure: Client, Company Code, Plant, Storage Location, Purchasing Org',
      'Master Data Architecture: Business Partner (BP), Material Master (MM01), Info Records, Source Lists',
      'Standard Business Processes: Procure-to-Pay (P2P), Order-to-Cash (O2C), Record-to-Report (R2R)',
      'Transaction Code Standards: ME51N (PR), ME21N (PO), MIGO (GR), MIRO (IR), MM01, BP',
      'Configuration & IMG Customizing: SPRO configuration, document types, release strategies',
      'Analytics & Reporting: SAP Fiori Launchpad analytics, standard evaluation tables (EKKO, EKPO, MARA)',
    ],
    referenceLinks: [
      {
        title: 'SAP Learning Hub & Global Certification Portal',
        url: 'https://learning.sap.com/',
        description: 'Official SAP digital learning journeys, role-based courses, and exam blueprints.',
        isOpenAccess: true,
        approvalNature: 'Official Vendor Training Standard',
      },
      {
        title: 'SAP Help Portal - S/4HANA Product Documentation',
        url: 'https://help.sap.com/',
        description: 'Authoritative documentation on standard transaction codes, customizing, and features.',
        isOpenAccess: true,
        approvalNature: 'Authorized Enterprise Reference',
      },
      {
        title: 'SAP Community - Best Practices & Knowledge Base',
        url: 'https://community.sap.com/',
        description: 'Verified enterprise implementation guides and solution architecture articles.',
        isOpenAccess: true,
        approvalNature: 'Open Enterprise Community Standard',
      },
    ],
  },

  python: {
    domain: 'Software Engineering, Computer Science & Systems',
    bodyName: 'Python Software Foundation (PSF) & IEEE/ACM',
    frameworkName: 'IEEE/ACM CS2023 Curricula & PEP Technical Standards',
    levelOrCode: 'ISO/IEC 25010 & Python Enhancement Proposals (PEP 8 / PEP 484 / PEP 695)',
    badge: 'PSF / IEEE Standard',
    badgeColor: '#10b981',
    governingAuthority: 'Python Software Foundation & IEEE Computer Society',
    approvalNature: 'Open-Access Industry Standard & International Academic Computing Curriculum',
    description: 'Industry-standard computer science educational guidelines governing clean code, algorithmic complexity, idiomatic typing, and asynchronous design.',
    standardStructure: [
      'Foundations: Data types, control flow, functional decomposition, scope, memory model',
      'Object-Oriented Design: Classes, inheritance, polymorphism, encapsulation, dunder protocols',
      'Standard Library & Data Structures: Collections, itertools, functools, pathlib, typing',
      'Type Systems & PEP Standards: PEP 8 styling, PEP 484 static typing, mypy / pyright validation',
      'Concurrency & Asynchronous I/O: Multiprocessing, threading, asyncio event loops',
      'Testing & Engineering Rigor: Pytest suites, CI/CD integration, packaging (pyproject.toml)',
    ],
    referenceLinks: [
      {
        title: 'Python Software Foundation - Official Documentation',
        url: 'https://docs.python.org/3/',
        description: 'Complete official language reference, standard library manual, and tutorials.',
        isOpenAccess: true,
        approvalNature: 'Authoritative Open-Source Documentation',
      },
      {
        title: 'IEEE Computer Society - Computing Curricula Standards',
        url: 'https://www.computer.org/education/curricula',
        description: 'International standards for university and professional computer science education.',
        isOpenAccess: true,
        approvalNature: 'Global Professional Society Standard',
      },
      {
        title: 'PEP 8 - Official Style Guide for Python Code',
        url: 'https://peps.python.org/pep-0008/',
        description: 'Authoritative conventions for readable, standardized, high-quality Python code.',
        isOpenAccess: true,
        approvalNature: 'Official Open Technical Standard',
      },
    ],
  },

  social_media: {
    domain: 'Social Media Strategy & Digital Marketing',
    bodyName: 'Digital Marketing Institute (DMI) & Meta Blueprint / OMCP',
    frameworkName: 'DMI Global Digital Marketing Standard & Meta Professional Framework',
    levelOrCode: 'CDMP (Certified Digital Marketing Professional) / OMCP® Certified',
    badge: 'DMI / Meta Aligned',
    badgeColor: '#ec4899',
    governingAuthority: 'Digital Marketing Institute (Dublin/Global) & Meta Platforms Blueprint',
    approvalNature: 'Global Professional Industry Certification & Vendor-Recognized Standard',
    description: 'Internationally accredited framework for multi-channel audience acquisition, viral social content engines, paid advertising attribution (ROAS/CPA), and brand community growth.',
    standardStructure: [
      'Pillar 1: Social Media Strategy & Persona Mapping (Audience psychographics, channel selection)',
      'Pillar 2: Organic Content Architecture & Storytelling (Hooks, retention pacing, viral formats)',
      'Pillar 3: Paid Social & Ads Optimization (Meta Ads Manager, TikTok Spark Ads, pixel tracking, ROAS)',
      'Pillar 4: Community Management & Brand Advocacy (Social listening, engagement loops, crisis PR)',
      'Pillar 5: Analytics, Attribution & Conversion Modeling (UTM tracking, GA4 social attribution, CTR/CAC)',
      'Pillar 6: Influencer Collaboration & Affiliate Ecosystems (Outreach briefs, contract rights, tracking)',
    ],
    referenceLinks: [
      {
        title: 'Digital Marketing Institute - Global Certification Syllabus',
        url: 'https://digitalmarketinginstitute.com/qualifications',
        description: 'Internationally accredited digital marketing and social media professional syllabus.',
        isOpenAccess: true,
        approvalNature: 'Global Professional Certification Authority',
      },
      {
        title: 'Meta Blueprint - Official Certification & Best Practices',
        url: 'https://www.facebook.com/business/learn/certification',
        description: 'Official Meta guidelines for Instagram, Facebook, and WhatsApp advertising and community management.',
        isOpenAccess: true,
        approvalNature: 'Authorized Platform Standard',
      },
      {
        title: 'HubSpot Academy - Social Media Marketing Certification',
        url: 'https://academy.hubspot.com/courses/social-media',
        description: 'Open-access comprehensive inbound social media marketing training curriculum.',
        isOpenAccess: true,
        approvalNature: 'Open-Access Professional Courseware',
      },
    ],
  },

  ai_ml: {
    domain: 'Artificial Intelligence, Machine Learning & Data Science',
    bodyName: 'ISO/IEC JTC 1/SC 42 & NIST AI Risk Management Framework',
    frameworkName: 'ISO/IEC 42001 (AI Management System) & NIST AI RMF 1.0',
    levelOrCode: 'ISO/IEC 42001:2023 / NIST AI 100-1 / IEEE 7000',
    badge: 'ISO / NIST AI Standard',
    badgeColor: '#8b5cf6',
    governingAuthority: 'International Organization for Standardization & NIST',
    approvalNature: 'International Consensus Standard & Government Framework',
    description: 'Comprehensive guidelines governing trustworthy AI architecture, large language model fine-tuning, retrieval-augmented generation (RAG), and responsible AI governance.',
    standardStructure: [
      'Foundations: Linear algebra, multivariable calculus, probability distributions, statistical modeling',
      'Classical Machine Learning: Supervised/unsupervised algorithms, scikit-learn, cross-validation',
      'Deep Learning & Neural Networks: PyTorch/TensorFlow architectures, transformers, attention mechanisms',
      'Generative AI & LLMs: Prompt engineering, embeddings, vector indexing, RAG pipelines, fine-tuning',
      'AI Ethics & Governance: Bias detection, explainability (XAI), safety alignment, ISO 42001 controls',
      'MLOps & Production Deployment: Model registry, CI/CD pipelines, inference latency optimization',
    ],
    referenceLinks: [
      {
        title: 'NIST AI Risk Management Framework (AI RMF 1.0)',
        url: 'https://www.nist.gov/itl/ai-risk-management-framework',
        description: 'US Federal open standard for designing trustworthy and responsible AI systems.',
        isOpenAccess: true,
        approvalNature: 'Open Government Framework',
      },
      {
        title: 'ISO/IEC 42001 Artificial Intelligence Management',
        url: 'https://www.iso.org/standard/81230.html',
        description: 'Global standard for managing risks and opportunities associated with AI.',
        isOpenAccess: true,
        approvalNature: 'International Standards Organization Specification',
      },
      {
        title: 'Stanford Center for Research on Foundation Models (CRFM)',
        url: 'https://crfm.stanford.edu/',
        description: 'Open academic benchmarks and research standards for large-scale AI models.',
        isOpenAccess: true,
        approvalNature: 'Academic Open Research Standard',
      },
    ],
  },

  ui_ux: {
    domain: 'UI/UX Design & Human-Centered Interaction',
    bodyName: 'Nielsen Norman Group (NN/g) & ISO TC 159',
    frameworkName: 'ISO 9241-210 (Human-Centred Design) & NN/g UX Framework',
    levelOrCode: 'ISO 9241-210:2019 / NN/g UX Master Certified',
    badge: 'ISO 9241 / NN/g Standard',
    badgeColor: '#06b6d4',
    governingAuthority: 'International Organization for Standardization & Nielsen Norman Group',
    approvalNature: 'International Ergonomics Standard & Premier Industry Usability Benchmark',
    description: 'Industry-standard design methodology focusing on user research, cognitive affordances, design system architecture, and accessibility (WCAG 2.2).',
    standardStructure: [
      'Dimension 1: User Research & Empathy (User interviews, journey mapping, empathy matrices)',
      'Dimension 2: Information Architecture & Wireframing (Card sorting, site taxonomy, low-fi wireframes)',
      'Dimension 3: Visual Design Systems & Tokens (Typography hierarchies, color contrast, component libraries)',
      'Dimension 4: Interaction Design & Micro-animations (Motion curves, states, feedback loops)',
      'Dimension 5: Usability Testing & Heuristic Evaluation (Nielsen 10 heuristics, task completion metrics)',
      'Dimension 6: Accessibility (WCAG 2.2 AA compliance, keyboard navigation, screen reader support)',
    ],
    referenceLinks: [
      {
        title: 'Nielsen Norman Group - UX Research Articles & Reports',
        url: 'https://www.nngroup.com/articles/',
        description: 'Authoritative evidence-based research on web and software usability heuristics.',
        isOpenAccess: true,
        approvalNature: 'Evidence-Based Industry Research',
      },
      {
        title: 'W3C Web Content Accessibility Guidelines (WCAG 2.2)',
        url: 'https://www.w3.org/WAI/standards-guidelines/wcag/',
        description: 'Global technical standard for making digital content accessible to all users.',
        isOpenAccess: true,
        approvalNature: 'W3C Open Technical Standard',
      },
    ],
  },

  healthcare: {
    domain: 'Healthcare, Clinical Practice & Health Informatics',
    bodyName: 'World Health Organization (WHO) & HL7 / HIPAA',
    frameworkName: 'HL7 FHIR & WHO Global Digital Health Strategy',
    levelOrCode: 'HL7 FHIR Release 5 / HIPAA Security Rule',
    badge: 'WHO / HL7 Compliant',
    badgeColor: '#14b8a6',
    governingAuthority: 'World Health Organization & Health Level Seven International',
    approvalNature: 'Global Intergovernmental Healthcare Standard & Open Health Data Protocol',
    description: 'Universal clinical governance and digital health interoperability standards ensuring patient safety, data privacy, and evidence-based clinical protocols.',
    standardStructure: [
      'Core Domain 1: Evidence-Based Clinical Guidelines (Diagnostic pathways, clinical trial synthesis)',
      'Core Domain 2: Health Informatics & Interoperability (HL7 FHIR data models, EHR integration)',
      'Core Domain 3: Medical Ethics & Patient Confidentiality (HIPAA, GDPR Health, patient consent)',
      'Core Domain 4: Clinical Safety & Quality Improvement (Root cause analysis, patient safety indicators)',
      'Core Domain 5: Public Health & Epidemiological Surveillance (WHO outbreak monitoring, disease registers)',
    ],
    referenceLinks: [
      {
        title: 'World Health Organization (WHO) - Guidelines Portal',
        url: 'https://www.who.int/publications/guidelines',
        description: 'Official global evidence-based clinical and public health guidance documents.',
        isOpenAccess: true,
        approvalNature: 'UN Health Agency Standard',
      },
      {
        title: 'HL7 FHIR (Fast Healthcare Interoperability Resources) Specification',
        url: 'https://hl7.org/fhir/',
        description: 'Open-access international standard for electronic health data exchange.',
        isOpenAccess: true,
        approvalNature: 'Open Healthcare Protocol Standard',
      },
    ],
  },

  cloud: {
    domain: 'Cloud Architecture & Distributed Infrastructure',
    bodyName: 'Cloud Native Computing Foundation (CNCF) & AWS/Azure',
    frameworkName: 'AWS Well-Architected Framework & NIST SP 800-145',
    levelOrCode: 'Solutions Architect Professional / NIST Cloud Standards',
    badge: 'NIST / CNCF Standard',
    badgeColor: '#f97316',
    governingAuthority: 'CNCF (The Linux Foundation) & Cloud Standards Consortium',
    approvalNature: 'Open-Source Cloud Consortium Standard & Vendor Architecture Framework',
    description: 'International architecture frameworks for scalable, resilient, highly available, and cost-optimized distributed cloud computing systems.',
    standardStructure: [
      'Pillar 1: Operational Excellence (Infrastructure as Code, monitoring, CI/CD, automation)',
      'Pillar 2: Security (Identity & Access Management, Zero-Trust, encryption at rest/transit)',
      'Pillar 3: Reliability (Fault tolerance, auto-scaling, distributed multi-region disaster recovery)',
      'Pillar 4: Performance Efficiency (Compute optimization, caching, serverless architectures)',
      'Pillar 5: Cost Optimization (Resource sizing, lifecycle policies, financial operations FinOps)',
      'Pillar 6: Sustainability (Carbon footprint minimization, compute workload efficiency)',
    ],
    referenceLinks: [
      {
        title: 'AWS Well-Architected Framework Whitepapers',
        url: 'https://aws.amazon.com/architecture/well-architected/',
        description: 'Comprehensive design principles and architectural review checklists.',
        isOpenAccess: true,
        approvalNature: 'Authorized Cloud Vendor Architecture Guide',
      },
      {
        title: 'Cloud Native Computing Foundation (CNCF) Landscape',
        url: 'https://www.cncf.io/',
        description: 'Open-source containerization, orchestration (Kubernetes), and microservices standards.',
        isOpenAccess: true,
        approvalNature: 'Open-Source Consortium Standard',
      },
      {
        title: 'NIST Cloud Computing Definition & Standards (SP 800-145)',
        url: 'https://www.nist.gov/programs-projects/nist-cloud-computing-program-nccp',
        description: 'US National Institute of Standards and Technology official cloud specifications.',
        isOpenAccess: true,
        approvalNature: 'Government Open Standard',
      },
    ],
  },

  project: {
    domain: 'Project Management & Operational Governance',
    bodyName: 'Project Management Institute (PMI)',
    frameworkName: 'PMBOK® Guide 7th Edition & Agile Practice Standard',
    levelOrCode: 'PMP® (Project Management Professional) / PMI-ACP®',
    badge: 'PMI PMBOK® Aligned',
    badgeColor: '#8b5cf6',
    governingAuthority: 'Project Management Institute (Newtown Square, PA, USA)',
    approvalNature: 'Global Accredited Professional Body Standard (ANSI/PMI)',
    description: 'Internationally accredited project management standard codifying 12 principles of project delivery and 8 project performance domains.',
    standardStructure: [
      'Performance Domain 1: Stakeholders (Engagement, communication, stakeholder mapping)',
      'Performance Domain 2: Team (High-performing culture, leadership, collaboration)',
      'Performance Domain 3: Development Approach & Life Cycle (Predictive, adaptive, hybrid, agile)',
      'Performance Domain 4: Planning (Scope, schedule, budget, procurement, resource allocation)',
      'Performance Domain 5: Project Work (Execution, managing change, continuous learning)',
      'Performance Domain 6: Delivery (Scope validation, quality assurance, value delivery)',
      'Performance Domain 7: Measurement (Key performance indicators, variance analysis, dashboards)',
      'Performance Domain 8: Uncertainty (Risk identification, mitigation, contingency reserves)',
    ],
    referenceLinks: [
      {
        title: 'Project Management Institute - PMBOK Guide Overview',
        url: 'https://www.pmi.org/pmbok-guide-standards',
        description: 'Global standard for project, program, and portfolio management practices.',
        isOpenAccess: true,
        approvalNature: 'Global Professional Standard',
      },
      {
        title: 'The Official Scrum Guide (Ken Schwaber & Jeff Sutherland)',
        url: 'https://scrumguides.org/',
        description: 'The definitive open-access guide to Scrum rules, roles, and events.',
        isOpenAccess: true,
        approvalNature: 'Open Technical Process Guide',
      },
    ],
  },

  finance: {
    domain: 'Finance, Accounting & Fiscal Governance',
    bodyName: 'IFRS Foundation & FASB',
    frameworkName: 'International Financial Reporting Standards (IFRS) & GAAP',
    levelOrCode: 'ACCA / CPA Global Standards',
    badge: 'IFRS / GAAP Compliant',
    badgeColor: '#059669',
    governingAuthority: 'International Accounting Standards Board (IASB, London)',
    approvalNature: 'Universal International Treaty & National Accounting Standards',
    description: 'Universal financial reporting and accounting principles ensuring global market transparency, auditability, and fiscal consistency.',
    standardStructure: [
      'Framework Foundations: Accrual principle, materiality, going concern, faithful representation',
      'Financial Statement Architecture: Balance Sheet, Income Statement, Cash Flows, Equity Changes',
      'Asset Valuation & Depreciation: IAS 16 Property, Plant & Equipment, IAS 36 Impairment',
      'Revenue Recognition: IFRS 15 (Five-Step Revenue Recognition Model)',
      'Financial Instruments & Leases: IFRS 9 (Classification & Measurement), IFRS 16 (Leases)',
      'Managerial Accounting & Auditing: Cost center accounting, variance analysis, internal controls',
    ],
    referenceLinks: [
      {
        title: 'IFRS Foundation - Official Accounting Standards',
        url: 'https://www.ifrs.org/issued-standards/list-of-standards/',
        description: 'Authoritative international financial reporting standards repository.',
        isOpenAccess: true,
        approvalNature: 'Official Global Accounting Authority',
      },
      {
        title: 'ACCA Global - Accounting Qualification Framework',
        url: 'https://www.accaglobal.com/',
        description: 'Worldwide educational and ethical standards for chartered certified accountants.',
        isOpenAccess: true,
        approvalNature: 'Chartered Professional Qualification Standard',
      },
    ],
  },

  security: {
    domain: 'Cybersecurity, Information Security & Privacy',
    bodyName: 'ISO/IEC & National Institute of Standards and Technology (NIST)',
    frameworkName: 'ISO/IEC 27001:2022 & NIST Cybersecurity Framework (CSF 2.0)',
    levelOrCode: 'ISO 27001 / NIST CSF 2.0 / OWASP Top 10',
    badge: 'ISO 27001 / NIST CSF',
    badgeColor: '#dc2626',
    governingAuthority: 'International Organization for Standardization & NIST',
    approvalNature: 'International Standards Organization & US Federal Open Framework',
    description: 'Standardized management framework for establishing, implementing, maintaining, and continually improving an Information Security Management System (ISMS).',
    standardStructure: [
      'Function 1: GOVERN (Establish enterprise cybersecurity strategy, policies, and risk tolerance)',
      'Function 2: IDENTIFY (Asset management, risk assessment, vulnerability scanning)',
      'Function 3: PROTECT (Access control, data security, awareness training, platform protection)',
      'Function 4: DETECT (Continuous security monitoring, anomaly detection, SIEM analysis)',
      'Function 5: RESPOND (Incident response execution, communication, analysis, containment)',
      'Function 6: RECOVER (Business continuity, disaster recovery restoration, post-incident review)',
    ],
    referenceLinks: [
      {
        title: 'NIST Cybersecurity Framework (CSF 2.0) Portal',
        url: 'https://www.nist.gov/cyberframework',
        description: 'US federal and international open framework for reducing cybersecurity risk.',
        isOpenAccess: true,
        approvalNature: 'Open Government Framework',
      },
      {
        title: 'ISO/IEC 27001 Information Security Management',
        url: 'https://www.iso.org/standard/27001',
        description: 'Global standard for enterprise information security management systems.',
        isOpenAccess: true,
        approvalNature: 'International Standards Organization Specification',
      },
      {
        title: 'OWASP Foundation - Web Application Security Risks',
        url: 'https://owasp.org/www-project-top-ten/',
        description: 'Open-access consensus document on the most critical security vulnerabilities.',
        isOpenAccess: true,
        approvalNature: 'Open Community Security Standard',
      },
    ],
  },

  generic: {
    domain: 'Global Professional Education & Competency',
    bodyName: 'International Standards Organization & UNESCO OER Frameworks',
    frameworkName: 'Bloom’s Revised Taxonomy & ISO/IEC 29993 Learning Services',
    levelOrCode: 'ISO 29993:2017 & EQF (European Qualifications Framework)',
    badge: 'ISO / EQF Aligned',
    badgeColor: '#6366f1',
    governingAuthority: 'International Organization for Standardization & UNESCO',
    approvalNature: 'International Open Pedagogical Benchmark & Open Educational Resources (OER)',
    description: 'Comprehensive pedagogical framework structuring progressive cognitive skills from foundational understanding to enterprise synthesis and evaluation.',
    standardStructure: [
      'Dimension 1: Remember & Understand (Core vocabulary, conceptual models, principles)',
      'Dimension 2: Apply & Execute (Real-world scenarios, workflow execution, tool utilization)',
      'Dimension 3: Analyze & Deconstruct (Problem diagnosis, comparative analysis, root cause)',
      'Dimension 4: Evaluate & Validate (Quality checks, trade-off analysis, architectural review)',
      'Dimension 5: Create & Innovate (End-to-end design, system synthesis, enterprise solution)',
    ],
    referenceLinks: [
      {
        title: 'UNESCO Open Educational Resources (OER) Initiative',
        url: 'https://www.unesco.org/en/open-educational-resources',
        description: 'Global public open-access educational frameworks and curriculum materials.',
        isOpenAccess: true,
        approvalNature: 'United Nations Open Educational Standard',
      },
      {
        title: 'European Qualifications Framework (EQF) Portal',
        url: 'https://europa.eu/europass/en/european-qualifications-framework-eqf',
        description: 'Comprehensive translation grid for international educational qualifications.',
        isOpenAccess: true,
        approvalNature: 'European Union Standard Framework',
      },
    ],
  },

  ielts: {
    domain: 'International English Assessment & Academic Communication',
    bodyName: 'Cambridge University Press & Assessment / British Council / IDP: IELTS',
    frameworkName: 'IELTS Standard Assessment Framework (Band 1.0 - 9.0)',
    levelOrCode: 'CEFR Levels B1, B2, C1, C2 (IELTS Bands 4.0 - 9.0)',
    badge: 'IELTS Band 8.0+ Framework',
    badgeColor: '#e11d48',
    governingAuthority: 'University of Cambridge, British Council, IDP: IELTS Australia',
    approvalNature: 'Official Global Standard for Higher Education & International Professional Practice',
    description: 'Premier standardized international test of English language proficiency assessing Listening, Reading, Writing, and Speaking across academic and general training modules.',
    standardStructure: [
      'Listening Module (40 Questions, 4 Sections): Everyday conversation, monologue, academic discussion, university lecture',
      'Academic Reading (40 Questions, 3 Long Texts): Skimming, scanning, True/False/Not Given, heading matching, diagram labeling',
      'Academic Writing (Tasks 1 & 2): Task 1 Data/Process report (150 words) & Task 2 Discursive essay (250 words, cohesive argument)',
      'Speaking Interview (3 Parts): Part 1 Introduction & familiar topics, Part 2 Long turn cue card (2 min), Part 3 Two-way abstract discussion',
    ],
    referenceLinks: [
      {
        title: 'Official IELTS Global Framework & Assessment Criteria',
        url: 'https://www.ielts.org/for-test-takers/how-ielts-is-scored',
        description: 'Official Band Descriptors for Task Achievement, Coherence & Cohesion, Lexical Resource, and Grammatical Range.',
        isOpenAccess: true,
        approvalNature: 'Official Standard Body',
      },
      {
        title: 'Cambridge English Assessment - IELTS Academic Blueprint',
        url: 'https://www.cambridgeenglish.org/exams-and-tests/ielts/',
        description: 'Authorized syllabus guidelines and examination specifications.',
        isOpenAccess: true,
        approvalNature: 'Authorized Examination Syndicate',
      },
      {
        title: 'British Council LearnEnglish & IELTS Preparation OER',
        url: 'https://takeielts.britishcouncil.org/take-ielts/prepare',
        description: 'Open practice materials, sample answer scripts, and official examiner commentaries.',
        isOpenAccess: true,
        approvalNature: 'Open Educational Resource (OER)',
      },
    ],
    examPassCriteria: {
      minPassingScore: 'Overall Band 7.5 - 8.5 (CEFR C1/C2 Mastery)',
      examFormat: '4 Modular Components (Listening: 30m, Reading: 60m, Writing: 60m, Speaking: 11-14m)',
      timeLimit: '2 Hours 45 Minutes total assessment',
      competencyDomains: [
        { name: 'Listening Comprehension', weight: '25%', description: 'Detail extraction, audio distractors, lecture synthesis' },
        { name: 'Academic Reading Analysis', weight: '25%', description: 'Critical argument analysis, inference, speed skimming' },
        { name: 'Academic Writing Cohesion', weight: '25%', description: 'Band 9 structure, lexical resource, grammatical accuracy' },
        { name: 'Spoken Fluency & Pronunciation', weight: '25%', description: 'Native-like cadence, discourse markers, topic elaboration' },
      ],
      certificationTitle: 'Official IELTS Test Report Form (TRF) - Band 8.0+ Mastery',
      preRequisites: 'Intermediate English proficiency (CEFR B1+) or foundational academic coursework',
      retakePolicy: 'One Skill Retake (OSR) available within 60 days of the original test',
    },
  },
};

/**
 * Detects the appropriate international standard body and framework based on course title or text
 */
export function detectStandardCurriculum(courseTitle: string, content?: string): StandardBodyInfo {
  const text = `${courseTitle} ${content?.slice(0, 1500) || ''}`.toLowerCase();

  // 1. IELTS Language Assessment
  if (
    text.includes('ielts') ||
    text.includes('band 7') ||
    text.includes('band 8') ||
    text.includes('band 9') ||
    text.includes('toefl') ||
    text.includes('cambridge english') ||
    text.includes('academic writing task')
  ) {
    return STANDARD_FRAMEWORKS.ielts;
  }

  // 2. German Language
  if (
    text.includes('german') ||
    text.includes('deutsch') ||
    text.includes('goethe') ||
    text.includes('cefr') ||
    /\b(a1|a2|b1|b2|c1|c2)\b/i.test(text)
  ) {
    return STANDARD_FRAMEWORKS.german;
  }

  // 3. SAP ERP
  if (
    text.includes('sap') ||
    text.includes('s/4hana') ||
    text.includes('fiori') ||
    text.includes('migo') ||
    text.includes('miro') ||
    text.includes('me21n') ||
    text.includes('mm01') ||
    text.includes('abap') ||
    text.includes('erp')
  ) {
    return STANDARD_FRAMEWORKS.sap;
  }

  // 4. AI, Machine Learning & Data Science
  if (
    text.includes('artificial intelligence') ||
    text.includes('machine learning') ||
    text.includes('deep learning') ||
    text.includes('data science') ||
    text.includes('llm') ||
    text.includes('neural') ||
    text.includes('pytorch') ||
    text.includes('tensorflow') ||
    text.includes('generative ai')
  ) {
    return STANDARD_FRAMEWORKS.ai_ml;
  }

  // 5. UI/UX & Human Centered Design
  if (
    text.includes('ui/ux') ||
    text.includes('ux design') ||
    text.includes('user experience') ||
    text.includes('figma') ||
    text.includes('usability') ||
    text.includes('interaction design') ||
    text.includes('wireframe')
  ) {
    return STANDARD_FRAMEWORKS.ui_ux;
  }

  // 6. Healthcare & Medical Informatics
  if (
    text.includes('healthcare') ||
    text.includes('medical') ||
    text.includes('clinical') ||
    text.includes('nursing') ||
    text.includes('pharmacy') ||
    text.includes('fhir') ||
    text.includes('hipaa') ||
    text.includes('hospital')
  ) {
    return STANDARD_FRAMEWORKS.healthcare;
  }

  // 7. Python, Programming & Software Engineering
  if (
    text.includes('python') ||
    text.includes('django') ||
    text.includes('fastapi') ||
    text.includes('javascript') ||
    text.includes('typescript') ||
    text.includes('react') ||
    text.includes('node') ||
    text.includes('sql') ||
    text.includes('coding') ||
    text.includes('programming') ||
    text.includes('software engineer') ||
    text.includes('java') ||
    text.includes('c++') ||
    text.includes('golang')
  ) {
    return STANDARD_FRAMEWORKS.python;
  }

  // 8. Cloud & Infrastructure
  if (
    text.includes('aws') ||
    text.includes('azure') ||
    text.includes('cloud') ||
    text.includes('kubernetes') ||
    text.includes('docker') ||
    text.includes('devops') ||
    text.includes('terraform')
  ) {
    return STANDARD_FRAMEWORKS.cloud;
  }

  // 9. Project Management
  if (
    text.includes('project management') ||
    text.includes('pmp') ||
    text.includes('agile') ||
    text.includes('scrum') ||
    text.includes('pmbok') ||
    text.includes('jira')
  ) {
    return STANDARD_FRAMEWORKS.project;
  }

  // 10. Finance & Accounting
  if (
    text.includes('finance') ||
    text.includes('accounting') ||
    text.includes('ifrs') ||
    text.includes('gaap') ||
    text.includes('tax') ||
    text.includes('audit') ||
    text.includes('financial') ||
    text.includes('investing')
  ) {
    return STANDARD_FRAMEWORKS.finance;
  }

  // 11. Cybersecurity
  if (
    text.includes('security') ||
    text.includes('cyber') ||
    text.includes('iso 27001') ||
    text.includes('nist') ||
    text.includes('owasp') ||
    text.includes('penetration') ||
    text.includes('ethical hack')
  ) {
    return STANDARD_FRAMEWORKS.security;
  }

  return STANDARD_FRAMEWORKS.generic;
}

/**
 * Formats a rich Markdown block introducing the authorized curriculum benchmark
 */
export function formatStandardCurriculumMarkdown(info: StandardBodyInfo): string {
  let md = `\n\n> 🏛️ **Authorized Standard Curriculum & Framework Reference**\n>\n`;
  md += `> **Standard Governing Body:** ${info.bodyName} (${info.governingAuthority})\n`;
  md += `> **Recognized Framework:** ${info.frameworkName} • \`${info.levelOrCode}\`\n`;
  md += `> **Nature of Approval & Access:** ${info.approvalNature}\n`;
  md += `> **Pedagogical Benchmark:** ${info.description}\n>\n`;
  md += `> **Standard Competency Syllabus Structure:**\n`;
  info.standardStructure.forEach((item) => {
    md += `> - ${item}\n`;
  });
  md += `>\n> **Official Verified & Open-Access Reference Links:**\n`;
  info.referenceLinks.forEach((link) => {
    md += `> - [${link.title}](${link.url}) — *${link.description}* ${link.isOpenAccess ? '`(Open-Access)`' : ''} ${link.approvalNature ? `*(${link.approvalNature})*` : ''}\n`;
  });
  if (info.examPassCriteria) {
    md += `>\n> **Official Exam & Pass Criteria:**\n`;
    md += `> - **Certification Title:** ${info.examPassCriteria.certificationTitle}\n`;
    md += `> - **Passing Score:** ${info.examPassCriteria.minPassingScore}\n`;
    md += `> - **Format & Time:** ${info.examPassCriteria.examFormat} (${info.examPassCriteria.timeLimit})\n`;
  }
  md += `\n`;
  return md;
}

/**
 * Dynamically queries Gemini AI to discover top authoritative governing bodies,
 * syllabus roadmaps, open-source resources, and official exam pass criteria for ANY subject.
 */
export async function fetchDynamicAuthorizedStandard(
  topic: string,
  content?: string,
  targetAudience?: string,
  modelOverride?: string
): Promise<StandardBodyInfo> {
  const fallback = detectStandardCurriculum(topic, content);

  const apiKey =
    import.meta.env.VITE_ILA_API_KEY ||
    import.meta.env.VITE_GEMINI_API_KEY ||
    import.meta.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_api_key_here') {
    return fallback;
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const activeModel = modelOverride || 'gemini-2.5-flash';

    const audienceClause = targetAudience
      ? `Tailor the governance standard and open-source materials specifically for the learner audience: ${targetAudience}.`
      : '';

    const prompt = `You are the Global Curriculum Accreditation & Standards Intelligence Engine.
Analyze the following course topic/content and determine the true, most prestigious, world-recognized governing bodies, standards organizations (e.g. CEFR, IEEE, ACM, WHO, AMA, ASME, PMI, ISO, IFRS, AWS, PSF, etc.), open-source learning repositories, syllabus roadmaps, and official certification exam pass criteria.

CRITICAL ANTI-HARDCODING RULE:
- Strictly derive all information dynamically from the provided topic only.
- Do NOT assume or force-fit SAP or Goethe unless the topic specifically is SAP or German language.

COURSE TOPIC: "${topic}"
${audienceClause}
SAMPLE EXTRACT: "${(content || '').substring(0, 1500)}"

Return ONLY a valid, parseable JSON object matching this exact schema:
{
  "domain": "Domain Name (e.g. Aerospace Engineering / Medical Informatics / German Linguistics)",
  "bodyName": "Governing Body Name (e.g. IEEE Computer Society / WHO / Council of Europe)",
  "frameworkName": "Official Recognized Framework Name",
  "levelOrCode": "Level or Blueprint Code (e.g. Professional Level 1-4 / A1-C2 / ISO-27001)",
  "badge": "Badge text (e.g. IEEE Standard Aligned / CEFR Authorized)",
  "badgeColor": "#38bdf8",
  "governingAuthority": "Headquarters / Authority location",
  "approvalNature": "Official Nature (e.g. International Open Standard / Accredited University Syllabus)",
  "description": "Comprehensive description of standard competency criteria and methodology",
  "standardStructure": [
    "Module/Level 1: Title and core competency requirements",
    "Module/Level 2: Title and core competency requirements",
    "Module/Level 3: Title and core competency requirements",
    "Module/Level 4: Title and core competency requirements"
  ],
  "referenceLinks": [
    {
      "title": "Authoritative Reference Title",
      "url": "https://...",
      "description": "Short description of the official portal or standard",
      "isOpenAccess": true,
      "approvalNature": "Official Framework"
    }
  ],
  "openSourceResources": [
    {
      "name": "Resource Name (e.g. OpenStax Textbook / Official Spec)",
      "type": "Textbook / OER",
      "url": "https://...",
      "provider": "Provider Name (e.g. MIT OpenCourseWare / OpenStax / GitHub)",
      "description": "Details of open access learning material",
      "accessLevel": "100% Free Open Access"
    }
  ],
  "examPassCriteria": {
    "minPassingScore": "e.g. 70% (Passing Threshold)",
    "examFormat": "e.g. 60 Multiple-Choice & Scenario Practical Lab Tasks",
    "timeLimit": "e.g. 90 Minutes",
    "competencyDomains": [
      { "name": "Foundational Principles", "weight": "25%" },
      { "name": "Core Application & Methods", "weight": "35%" },
      { "name": "Advanced Execution & Edge Cases", "weight": "40%" }
    ],
    "certificationTitle": "Official Certification or Course Mastery Credential",
    "preRequisites": "Prerequisites or entry baseline"
  }
}`;

    const response = await ai.models.generateContent({
      model: activeModel,
      contents: prompt,
    });

    if (response && response.text) {
      const cleaned = response.text
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.bodyName && parsed.frameworkName) {
        return {
          ...fallback,
          ...parsed,
          badgeColor: parsed.badgeColor || fallback.badgeColor || '#38bdf8',
        };
      }
    }
  } catch (err) {
    console.warn('Dynamic standard discovery fallback triggered:', err);
  }

  return fallback;
}
