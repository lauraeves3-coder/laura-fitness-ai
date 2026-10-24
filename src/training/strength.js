// MUS-02/04: plano de musculação por objetivo, nível, dias, equipamento e limitações.
// Função pura. Progressão dupla: ao completar o topo das repetições em todas as séries
// com a técnica boa, aumenta a carga (2–5%) e volta ao início da faixa.

export const STRENGTH_GOALS = {
  hipertrofia: { label: "hipertrofia", sets: [3, 4], reps: "8–12", rest_s: 90, rir: "1–2" },
  forca: { label: "força", sets: [4, 5], reps: "4–6", rest_s: 150, rir: "2" },
  emagrecimento: { label: "emagrecimento", sets: [3, 3], reps: "12–15", rest_s: 60, rir: "2" },
  condicionamento: { label: "condicionamento", sets: [3, 3], reps: "12–15", rest_s: 45, rir: "2–3" },
  saude: { label: "saúde e manutenção", sets: [2, 3], reps: "10–15", rest_s: 60, rir: "2–3" },
  corrida: { label: "fortalecimento para corrida", sets: [2, 3], reps: "8–12", rest_s: 75, rir: "2–3" }
};

// Exercícios por padrão de movimento. equipment: academia | halteres | casa.
// avoid: limitações em que o exercício é trocado.
const LIBRARY = {
  peito: [
    { name: "Supino reto com barra", equipment: ["academia"], avoid: ["ombro"] },
    { name: "Supino inclinado com halteres", equipment: ["academia", "halteres"], avoid: ["ombro"] },
    { name: "Crucifixo na máquina (peck deck)", equipment: ["academia"], avoid: [] },
    { name: "Flexão de braços", equipment: ["casa", "halteres", "academia"], avoid: ["punho"] }
  ],
  costas: [
    { name: "Puxada frontal na polia", equipment: ["academia"], avoid: [] },
    { name: "Remada baixa na polia", equipment: ["academia"], avoid: [] },
    { name: "Remada unilateral com halter", equipment: ["academia", "halteres"], avoid: [] },
    { name: "Remada curvada com barra", equipment: ["academia"], avoid: ["lombar"] },
    { name: "Remada com elástico ou mochila", equipment: ["casa"], avoid: [] },
    { name: "Barra fixa (ou assistida)", equipment: ["academia", "casa"], avoid: ["ombro"] }
  ],
  ombros: [
    { name: "Desenvolvimento com halteres", equipment: ["academia", "halteres"], avoid: ["ombro"] },
    { name: "Elevação lateral com halteres", equipment: ["academia", "halteres", "casa"], avoid: [] },
    { name: "Face pull na polia", equipment: ["academia"], avoid: [] }
  ],
  quadriceps: [
    { name: "Agachamento livre", equipment: ["academia"], avoid: ["joelho", "lombar"] },
    { name: "Leg press 45°", equipment: ["academia"], avoid: [] },
    { name: "Agachamento goblet com halter", equipment: ["academia", "halteres"], avoid: ["joelho"] },
    { name: "Cadeira extensora", equipment: ["academia"], avoid: ["joelho"] },
    { name: "Agachamento livre com peso do corpo", equipment: ["casa"], avoid: ["joelho"] },
    { name: "Afundo (passada)", equipment: ["academia", "halteres", "casa"], avoid: ["joelho"] }
  ],
  posterior: [
    { name: "Stiff com barra ou halteres", equipment: ["academia", "halteres"], avoid: ["lombar"] },
    { name: "Mesa flexora", equipment: ["academia"], avoid: [] },
    { name: "Elevação pélvica (hip thrust)", equipment: ["academia", "halteres", "casa"], avoid: [] },
    { name: "Ponte de glúteo unilateral", equipment: ["casa", "halteres"], avoid: [] }
  ],
  panturrilha: [
    { name: "Panturrilha em pé", equipment: ["academia", "halteres", "casa"], avoid: [] }
  ],
  biceps: [
    { name: "Rosca direta com barra ou halteres", equipment: ["academia", "halteres"], avoid: [] },
    { name: "Rosca com elástico", equipment: ["casa"], avoid: [] }
  ],
  triceps: [
    { name: "Tríceps na polia (corda)", equipment: ["academia"], avoid: [] },
    { name: "Tríceps francês com halter", equipment: ["halteres"], avoid: ["ombro"] },
    { name: "Mergulho no banco", equipment: ["casa"], avoid: ["ombro"] }
  ],
  core: [
    { name: "Prancha", equipment: ["academia", "halteres", "casa"], avoid: [] },
    { name: "Prancha lateral", equipment: ["academia", "halteres", "casa"], avoid: [] },
    { name: "Dead bug", equipment: ["academia", "halteres", "casa"], avoid: [] }
  ]
};

// Divisões por dias/semana. Cada sessão lista padrões (com repetição = 2 exercícios).
const SPLITS = {
  1: [{ label: "Corpo inteiro", patterns: ["quadriceps", "posterior", "peito", "costas", "ombros", "core"] }],
  2: [
    { label: "Corpo inteiro A", patterns: ["quadriceps", "peito", "costas", "ombros", "biceps", "core"] },
    { label: "Corpo inteiro B", patterns: ["posterior", "costas", "peito", "quadriceps", "triceps", "core"] }
  ],
  3: [
    { label: "A — Empurrar (peito, ombros, tríceps)", patterns: ["peito", "peito", "ombros", "ombros", "triceps", "core"] },
    { label: "B — Puxar (costas, bíceps)", patterns: ["costas", "costas", "costas", "ombros", "biceps", "core"] },
    { label: "C — Pernas", patterns: ["quadriceps", "quadriceps", "posterior", "posterior", "panturrilha", "core"] }
  ],
  4: [
    { label: "A — Superiores", patterns: ["peito", "costas", "ombros", "costas", "biceps", "triceps"] },
    { label: "B — Inferiores", patterns: ["quadriceps", "posterior", "quadriceps", "posterior", "panturrilha", "core"] },
    { label: "C — Superiores", patterns: ["costas", "peito", "ombros", "peito", "triceps", "biceps"] },
    { label: "D — Inferiores", patterns: ["posterior", "quadriceps", "posterior", "panturrilha", "core", "core"] }
  ],
  5: [
    { label: "A — Empurrar", patterns: ["peito", "peito", "ombros", "ombros", "triceps"] },
    { label: "B — Puxar", patterns: ["costas", "costas", "costas", "biceps", "core"] },
    { label: "C — Pernas", patterns: ["quadriceps", "quadriceps", "posterior", "posterior", "panturrilha"] },
    { label: "D — Superiores", patterns: ["peito", "costas", "ombros", "biceps", "triceps"] },
    { label: "E — Inferiores", patterns: ["posterior", "quadriceps", "posterior", "panturrilha", "core"] }
  ]
};
SPLITS[6] = [...SPLITS[3], ...SPLITS[3].map((session) => ({ ...session, label: session.label.replace(/^[ABC]/, (letter) => ({ A: "D", B: "E", C: "F" })[letter]) }))];

// Fortalecimento para quem corre: pernas unilaterais, posterior, panturrilha e core.
const RUNNER_SPLIT = [
  { label: "Fortalecimento A (corrida)", patterns: ["quadriceps", "posterior", "panturrilha", "costas", "core", "core"] },
  { label: "Fortalecimento B (corrida)", patterns: ["posterior", "quadriceps", "panturrilha", "peito", "core", "core"] }
];

function pickExercise(pattern, { equipment, limitations, used, variant }) {
  const options = LIBRARY[pattern].filter((exercise) =>
    exercise.equipment.includes(equipment) && !exercise.avoid.some((limit) => limitations.includes(limit)));
  // Sem repetir exercício na mesma sessão: sem opção nova, o espaço fica de fora.
  const fresh = options.filter((exercise) => !used.has(exercise.name));
  return fresh.length ? fresh[variant % fresh.length] : null;
}

// goal: chave de STRENGTH_GOALS; level: iniciante|intermediario|avancado;
// equipment: academia|halteres|casa; limitations: ["joelho", "lombar", "ombro", "punho"].
export function generateStrengthPlan({ goal = "hipertrofia", level = "iniciante", daysPerWeek = 3, equipment = "academia", limitations = [] }) {
  const config = STRENGTH_GOALS[goal] || STRENGTH_GOALS.hipertrofia;
  const days = Math.min(6, Math.max(1, Math.round(daysPerWeek)));
  // Iniciante treina o corpo inteiro até 3 dias; acima disso usa a divisão.
  const split = goal === "corrida"
    ? RUNNER_SPLIT.slice(0, Math.max(1, Math.min(2, days)))
    : level === "iniciante" && days <= 3 ? SPLITS[Math.min(days, 2)].concat(days === 3 ? [SPLITS[2][0]] : []) : SPLITS[days];
  const sets = level === "iniciante" ? config.sets[0] : config.sets[1];

  const sessions = split.map((session, sessionIndex) => {
    const used = new Set();
    const exercises = session.patterns.map((pattern, index) => {
      const exercise = pickExercise(pattern, { equipment, limitations, used, variant: sessionIndex + index });
      if (!exercise) return null;
      used.add(exercise.name);
      const core = pattern === "core";
      return {
        name: exercise.name,
        muscle: pattern,
        sets: core ? 3 : sets,
        reps: core ? (exercise.name.startsWith("Prancha") ? "30–45 s" : "10–12") : config.reps,
        rest_s: core ? 45 : config.rest_s,
        rir: config.rir
      };
    }).filter(Boolean);
    return { label: session.label, exercises };
  });

  return {
    modality: "musculacao",
    goal,
    goal_label: config.label,
    level,
    days_per_week: days,
    equipment,
    limitations,
    sessions,
    progression: `Progressão dupla: quando fizer ${config.reps.split("–").pop()} repetições em todas as séries com boa técnica, aumente a carga em 2–5% e volte ao início da faixa. Termine cada série com ${config.rir} repetições "na reserva".`
  };
}
