import type { Conversation, Library, Person } from "@raices/shared";

export const demoUser = {
  personId: "demo-elena",
  name: "Elena Sánchez Navarro",
  email: "elena.sanchez@example.com",
};

const familyPerson = (id: string, name: string, role: string): Person => ({
  id: `demo-${id}`,
  name,
  aliases: [role],
  candidateIds: [],
});

export const demoFamilyPeople: Person[] = [
  familyPerson("jose", "José Sánchez", "Bisabuelo paterno de Elena"),
  familyPerson("carmen", "Carmen Ruiz", "Bisabuela paterna de Elena"),
  familyPerson("francisco", "Francisco Gómez", "Bisabuelo paterno de Elena"),
  familyPerson("teresa-leon", "Teresa León", "Bisabuela paterna de Elena"),
  familyPerson("pedro", "Pedro Navarro", "Bisabuelo materno de Elena"),
  familyPerson("isabel", "Isabel Torres", "Bisabuela materna de Elena"),
  familyPerson("miguel", "Miguel Martín", "Bisabuelo materno de Elena"),
  familyPerson("rosa", "Rosa Vega", "Bisabuela materna de Elena"),
  familyPerson("rafael", "Rafael Sánchez", "Abuelo paterno de Elena"),
  familyPerson("pilar", "Pilar Gómez", "Abuela paterna de Elena"),
  familyPerson("luis", "Luis Navarro", "Abuelo materno de Elena"),
  familyPerson("ana", "Ana Martín", "Abuela materna de Elena"),
  familyPerson("manuel", "Manuel Sánchez", "Padre de Elena"),
  familyPerson("antonio", "Antonio Sánchez", "Tío paterno de Elena"),
  familyPerson("teresa-sanchez", "Teresa Sánchez", "Tía paterna de Elena"),
  familyPerson("clara", "Clara López", "Tía política de Elena"),
  familyPerson("maria", "María Navarro", "Madre de Elena"),
  familyPerson("julia", "Julia Navarro", "Tía materna de Elena"),
  familyPerson("fernando", "Fernando Navarro", "Tío materno de Elena"),
  familyPerson("pablo", "Pablo Pérez", "Tío político de Elena"),
  familyPerson("eva", "Eva Vega", "Tía política de Elena"),
  familyPerson("elena", demoUser.name, "Árbol centrado en Elena"),
  familyPerson("diego", "Diego Sánchez Navarro", "Hermano de Elena"),
  familyPerson("lucia", "Lucía Sánchez Navarro", "Hermana de Elena"),
  familyPerson("sofia", "Sofía Sánchez López", "Prima paterna de Elena"),
  familyPerson("mateo", "Mateo Sánchez López", "Primo paterno de Elena"),
  familyPerson("ines", "Inés Pérez Navarro", "Prima materna de Elena"),
  familyPerson("daniel", "Daniel Navarro Vega", "Primo materno de Elena"),
];

export const demoFamilyGenerations = [
  {
    title: "Bisabuelos",
    groups: [
      { title: "Rama Sánchez", ids: ["demo-jose", "demo-carmen"] },
      { title: "Rama Gómez", ids: ["demo-francisco", "demo-teresa-leon"] },
      { title: "Rama Navarro", ids: ["demo-pedro", "demo-isabel"] },
      { title: "Rama Martín", ids: ["demo-miguel", "demo-rosa"] },
    ],
  },
  {
    title: "Abuelos",
    groups: [
      { title: "Paternos", ids: ["demo-rafael", "demo-pilar"] },
      { title: "Maternos", ids: ["demo-luis", "demo-ana"] },
    ],
  },
  {
    title: "Padres y tíos",
    groups: [
      {
        title: "Familia Sánchez",
        ids: [
          "demo-manuel",
          "demo-antonio",
          "demo-clara",
          "demo-teresa-sanchez",
        ],
      },
      {
        title: "Familia Navarro",
        ids: [
          "demo-maria",
          "demo-julia",
          "demo-pablo",
          "demo-fernando",
          "demo-eva",
        ],
      },
    ],
  },
  {
    title: "Hermanos y primos",
    groups: [
      {
        title: "Elena y sus hermanos",
        ids: ["demo-elena", "demo-diego", "demo-lucia"],
      },
      { title: "Primos paternos", ids: ["demo-sofia", "demo-mateo"] },
      { title: "Primos maternos", ids: ["demo-ines", "demo-daniel"] },
    ],
  },
];

export const demoFamilyParents: Record<string, string[]> = {
  "demo-rafael": ["demo-jose", "demo-carmen"],
  "demo-pilar": ["demo-francisco", "demo-teresa-leon"],
  "demo-luis": ["demo-pedro", "demo-isabel"],
  "demo-ana": ["demo-miguel", "demo-rosa"],
  "demo-manuel": ["demo-rafael", "demo-pilar"],
  "demo-antonio": ["demo-rafael", "demo-pilar"],
  "demo-teresa-sanchez": ["demo-rafael", "demo-pilar"],
  "demo-maria": ["demo-luis", "demo-ana"],
  "demo-julia": ["demo-luis", "demo-ana"],
  "demo-fernando": ["demo-luis", "demo-ana"],
  "demo-elena": ["demo-manuel", "demo-maria"],
  "demo-diego": ["demo-manuel", "demo-maria"],
  "demo-lucia": ["demo-manuel", "demo-maria"],
  "demo-sofia": ["demo-antonio", "demo-clara"],
  "demo-mateo": ["demo-antonio", "demo-clara"],
  "demo-ines": ["demo-julia", "demo-pablo"],
  "demo-daniel": ["demo-fernando", "demo-eva"],
};

export const demoFamilyPartners: [string, string][] = [
  ["demo-jose", "demo-carmen"],
  ["demo-francisco", "demo-teresa-leon"],
  ["demo-pedro", "demo-isabel"],
  ["demo-miguel", "demo-rosa"],
  ["demo-rafael", "demo-pilar"],
  ["demo-luis", "demo-ana"],
  ["demo-manuel", "demo-maria"],
  ["demo-antonio", "demo-clara"],
  ["demo-julia", "demo-pablo"],
  ["demo-fernando", "demo-eva"],
];

// Archivo ficticio para explorar la aplicación. No se guarda ni se envía al servidor.
const elenaMemory: Conversation = {
  id: "demo-elena-memory",
  title: "Elena recuerda los veranos en Jaén",
  createdAt: "2026-10-12T17:30:00.000Z",
  duration: 1080,
  status: "ready",
  summary:
    "Elena recuerda los veranos en casa de sus abuelos, las tardes con su tío Antonio y el cuaderno donde empezó a conservar historias familiares.",
  error: null,
  bookmarks: [],
  demo: true,
  segments: [
    {
      id: "demo-elena-segment-1",
      start: 42,
      end: 58,
      text: "De pequeña pasaba todos los veranos en Jaén, en casa de mis abuelos. Mi tío Antonio nos llevaba a recoger aceitunas al amanecer.",
      speaker: "Elena (ejemplo)",
    },
    {
      id: "demo-elena-segment-2",
      start: 310,
      end: 326,
      text: "A los doce años empecé a escribir las historias que me contaba mi padre Manuel en un cuaderno azul.",
      speaker: "Elena (ejemplo)",
    },
  ],
  claims: [
    {
      id: "demo-elena-claim-1",
      conversationId: "demo-elena-memory",
      personId: demoUser.personId,
      segmentId: "demo-elena-segment-1",
      quote:
        "De pequeña pasaba todos los veranos en Jaén, en casa de mis abuelos.",
      statement: "Elena pasaba los veranos de su infancia en Jaén.",
      certainty: "pending",
    },
    {
      id: "demo-elena-claim-2",
      conversationId: "demo-elena-memory",
      personId: demoUser.personId,
      segmentId: "demo-elena-segment-2",
      quote:
        "A los doce años empecé a escribir las historias que me contaba mi padre Manuel en un cuaderno azul.",
      statement:
        "Elena empezó a conservar relatos familiares en un cuaderno a los doce años.",
      certainty: "approximate",
    },
  ],
  events: [
    {
      id: "demo-elena-event-1",
      conversationId: "demo-elena-memory",
      description: "Veranos de infancia en casa de sus abuelos",
      type: "recuerdo",
      year: 1998,
      place: "Jaén",
      certainty: "approximate",
      personIds: [demoUser.personId, "demo-antonio"],
      claimIds: ["demo-elena-claim-1"],
    },
    {
      id: "demo-elena-event-2",
      conversationId: "demo-elena-memory",
      description: "Empieza su cuaderno de historias familiares",
      type: "recuerdo",
      year: 2002,
      place: "Madrid",
      certainty: "approximate",
      personIds: [demoUser.personId, "demo-manuel"],
      claimIds: ["demo-elena-claim-2"],
    },
  ],
};

const manuelMemory: Conversation = {
  id: "demo-childhood",
  title: "La infancia del abuelo Manuel",
  createdAt: "2026-10-10T15:30:00.000Z",
  duration: 1260,
  status: "ready",
  summary:
    "Manuel recuerda los olivares de Jaén y cómo su familia se trasladó a Madrid. Allí conoció años después a María y formaron una familia.",
  error: null,
  bookmarks: [],
  demo: true,
  segments: [
    {
      id: "demo-manuel-segment-1",
      start: 32,
      end: 46,
      text: "Cuando tenía unos 14 años nos fuimos de Jaén a Madrid. Mi padre ya estaba trabajando allí y al año siguiente vino también mi hermano Antonio.",
      speaker: "Manuel (ejemplo)",
    },
    {
      id: "demo-manuel-segment-2",
      start: 450,
      end: 462,
      text: "María y yo nos conocimos en la biblioteca del barrio. Más adelante nació nuestra hija Elena.",
      speaker: "Manuel (ejemplo)",
    },
  ],
  claims: [
    {
      id: "demo-manuel-claim-1",
      conversationId: "demo-childhood",
      personId: "demo-manuel",
      segmentId: "demo-manuel-segment-1",
      quote: "Cuando tenía unos 14 años nos fuimos de Jaén a Madrid.",
      statement: "Manuel se trasladó de Jaén a Madrid con unos 14 años.",
      certainty: "approximate",
    },
    {
      id: "demo-manuel-claim-2",
      conversationId: "demo-childhood",
      personId: demoUser.personId,
      segmentId: "demo-manuel-segment-2",
      quote: "Más adelante nació nuestra hija Elena.",
      statement: "Elena es hija de Manuel y María.",
      certainty: "pending",
    },
  ],
  events: [
    {
      id: "demo-manuel-event-1",
      conversationId: "demo-childhood",
      description: "De Jaén a Madrid: el comienzo de una nueva vida",
      type: "mudanza",
      year: 1964,
      place: "Madrid",
      certainty: "approximate",
      personIds: ["demo-manuel", "demo-antonio"],
      claimIds: ["demo-manuel-claim-1"],
    },
    {
      id: "demo-manuel-event-2",
      conversationId: "demo-childhood",
      description: "Manuel y María forman una familia",
      type: "familia",
      year: null,
      place: "Madrid",
      certainty: "pending",
      personIds: [demoUser.personId, "demo-manuel", "demo-maria"],
      claimIds: ["demo-manuel-claim-2"],
    },
  ],
};

const mariaMemory: Conversation = {
  id: "demo-recipes",
  title: "El puchero de la abuela María",
  createdAt: "2026-10-07T11:00:00.000Z",
  duration: 1440,
  status: "ready",
  summary:
    "María y Elena cuentan cómo preparaban juntas el puchero de los domingos y cómo la receta pasó a la siguiente generación.",
  error: null,
  bookmarks: [],
  demo: true,
  segments: [
    {
      id: "demo-maria-segment-1",
      start: 75,
      end: 89,
      text: "Los domingos preparábamos el puchero juntas. Elena cortaba las verduras y yo le enseñaba las cantidades a ojo.",
      speaker: "María (ejemplo)",
    },
  ],
  claims: [
    {
      id: "demo-maria-claim-1",
      conversationId: "demo-recipes",
      personId: demoUser.personId,
      segmentId: "demo-maria-segment-1",
      quote: "Los domingos preparábamos el puchero juntas.",
      statement: "Elena aprendió a preparar el puchero familiar con María.",
      certainty: "pending",
    },
  ],
  events: [
    {
      id: "demo-maria-event-1",
      conversationId: "demo-recipes",
      description: "La receta del puchero pasa de María a Elena",
      type: "tradición",
      year: null,
      place: "Madrid",
      certainty: "pending",
      personIds: [demoUser.personId, "demo-maria"],
      claimIds: ["demo-maria-claim-1"],
    },
  ],
};

export const demoLibrary: Library = {
  people: demoFamilyPeople,
  conversations: [elenaMemory, manuelMemory, mariaMemory],
};
