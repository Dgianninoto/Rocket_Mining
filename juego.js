/* CÓDIGO DEL JUEGO
   Generado desde cambios/src/ sin minificar para facilitar la lectura.
   Para hacer cambios permanentes, editá los archivos fuente de cambios/src/. */
(async () => {

// === CAMPAÑA Y PLANETAS: destinos, modificadores y progresión. ===
// Fuente: cambios/src/simulation/campaign.ts
function random(seed, index) {
  let n = index | 0;
  for (const c of seed) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return (n >>> 0) / 4294967296;
}
function planetInfo(index, seed) {
  if (index === 0) return { index, name: "Aurora", biome: "temperate", description: "El comienzo de tu industria espacial.", power: 1, mining: 1, richness: 1, rare: null };
  if (index === 1) return { index, name: "Borealis", biome: "ice", description: "Titanio entre glaciares. El fr\xEDo reduce la generaci\xF3n el\xE9ctrica un 20 %.", power: 0.8, mining: 1, richness: 1.8, rare: "titanium" };
  if (index === 2) return { index, name: "Vulcan", biome: "volcanic", description: "Cristales volc\xE1nicos. La generaci\xF3n aumenta un 10 % y las mineras consumen un 40 % m\xE1s.", power: 1.1, mining: 1.4, richness: 2.8, rare: "crystal" };
  const n = random(seed, index), biome = n < 0.33 ? "ice" : n < 0.66 ? "volcanic" : "temperate";
  const prefixes = ["N\xE9bula", "\xD3nice", "\xCDcaro", "Helix", "Eclipse", "Lumen"], suffixes = ["Prime", "Delta", "Nexus", "Nova", "Zenit", "Echo"];
  return { index, name: `${prefixes[Math.floor(n * 6)]} ${suffixes[Math.floor(random(seed + "sector", index) * 6)]} ${index - 2}`, biome, description: `Expedici\xF3n ${index - 2}. Nuevas reservas de titanio y cristal; demanda espacial creciente.`, power: biome === "ice" ? 0.8 : biome === "volcanic" ? 1.1 : 1, mining: biome === "volcanic" ? 1.4 : 1, richness: Math.min(1e9, 3 + index * 1.5), rare: "both" };
}
function expeditionScale(highest) {
  const tier = Math.max(0, highest - 2);
  return Math.pow(1.35, Math.min(tier, 32)) * (1 + Math.max(0, tier - 32) * 0.1);
}
function rocketRequirements(highest) {
  const scale = expeditionScale(highest) * (highest < 3 ? 1 + highest * 0.5 : 2);
  return { rocketFrame: Math.ceil(6 * scale), rocketEngine: Math.ceil(3 * scale), advancedCircuit: Math.ceil(3 * scale), rocketFuel: Math.ceil(6 * scale), ...highest >= 1 ? { alloy: Math.ceil(3 * scale) } : {}, ...highest >= 2 ? { navCore: Math.ceil(2 * scale) } : {} };
}
function orbitalBatch(rank) {
  return Math.min(256, 2 ** Math.min(8, Math.floor(rank / 2)));
}


// === GUARDADO: validar, convertir y recuperar estados de partidas. ===
// Fuente: cambios/src/persistence/persistence.ts
var finite = (n) => typeof n === "number" && Number.isFinite(n) && n >= 0;
var count = (n) => finite(n) && Number.isSafeInteger(n);
var object = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var stock = (v) => object(v) && ITEMS.every((i) => count(v[i]));
var dir = (n) => count(n) && n < 4;
var tile = (n) => count(n) && n < SIZE;
function colonyValid(c, s) {
  if (!object(c) || typeof c.seed !== "string" || c.seed.length < 1 || c.seed.length > 128 || !object(c.player) || !finite(c.player.x) || !finite(c.player.y) || c.player.x < 0.28 || c.player.y < 0.28 || c.player.x > SIZE - 0.28 || c.player.y > SIZE - 0.28 || !stock(c.inventory) || !Array.isArray(c.machines) || c.machines.length > SIZE * SIZE || !object(c.depleted)) return false;
  const batch = orbitalBatch(s.orbitalRank), requirements = rocketRequirements(s.highestPlanet);
  const validMachine = (m) => {
    if (!object(m) || !tile(m.x) || !tile(m.y) || !TYPES.includes(m.type) || m.x + machineSize(m) > SIZE || m.y + machineSize(m) > SIZE || m.size !== void 0 && m.size !== 1 && m.size !== 2 || !dir(m.dir) || !dir(m.entry) || !stock(m.stock) || !stock(m.output) || !stock(m.cargo) || totalCargo(m.cargo) > 100 + s.orbitalRank * 25 || !finite(m.progress) || !finite(m.fuel) || m.fuel > (m.type === "generator" ? 20 : 8) || !count(m.produced) || !(m.type === "assembler" && m.recipe === "none") && !Object.hasOwn(RECIPES, m.recipe) || typeof m.exporting !== "boolean" || m.branch !== 0 && m.branch !== 1) return false;
    const duration = m.type === "launchpad" ? 6 : m.type === "furnace" || m.type === "lab" ? 2 : m.type === "assembler" && m.recipe !== "none" ? RECIPES[m.recipe].seconds : 1;
    if (m.type === "launchpad" ? m.progress > duration : m.progress >= duration) return false;
    const sum = (v) => ITEMS.reduce((a, i) => a + v[i], 0);
    if (m.type !== "launchpad" && sum(m.cargo) !== 0) return false;
    if (["belt", "splitter", "chest", "undergroundIn", "undergroundOut"].includes(m.type)) return sum(m.stock) <= (["belt", "undergroundIn", "undergroundOut"].includes(m.type) ? 1 : m.type === "splitter" ? 2 : 200) * batch && sum(m.output) === 0;
    if (m.type === "miner") return sum(m.stock) === 0 && sum(m.output) <= 5 * batch;
    if (m.type === "pole") return sum(m.stock) + sum(m.output) === 0;
    if (m.type === "inserter") return sum(m.stock) + sum(m.output) === 0 && m.progress <= 0.8 && m.fuel === 0;
    if (m.type === "generator") return m.stock.coal <= 10 && sum(m.stock) === m.stock.coal && sum(m.output) === 0;
    if (m.type === "lab") return m.stock.science <= 30 * batch && sum(m.stock) === m.stock.science && sum(m.output) === 0;
    if (m.type === "assembler" && m.recipe === "none" && m.progress !== 0) return false;
    if (m.type === "assembler") return ITEMS.every((i) => m.stock[i] <= 20 * batch) && sum(m.output) <= 10 * batch;
    if (m.type === "launchpad") return sum(m.output) === 0 && ITEMS.every((i) => m.stock[i] <= (requirements[i] ?? 0));
    return m.stock.iron <= 5 * batch && m.stock.copper <= 5 * batch && m.stock.coal <= 5 * batch && sum(m.stock) === m.stock.iron + m.stock.copper + m.stock.coal && sum(m.output) <= 5 * batch;
  };
  return c.machines.every(validMachine) && new Set(c.machines.flatMap((m) => Array.from({ length: machineSize(m) ** 2 }, (_, i) => `${m.x + i % machineSize(m)},${m.y + Math.floor(i / machineSize(m))}`))).size === c.machines.reduce((n, m) => n + machineSize(m) ** 2, 0) && Object.entries(c.depleted).every(([k, n]) => /^\d+,\d+$/.test(k) && k.split(",").every((v) => tile(Number(v))) && count(n)) && !c.machines.some((m) => !["belt", "splitter", "pole", "undergroundIn", "undergroundOut"].includes(m.type) && overlapsPlayer(m, c.player.x, c.player.y, 0.76));
}
function totalCargo(v) {
  return ITEMS.reduce((n, i) => n + v[i], 0);
}
function validState(value) {
  if (!object(value)) return false;
  const s = value;
  if (s.salvage !== void 0) {
    const r = s.salvage;
    if (!object(r) || !tile(r.x) || !tile(r.y) || r.x + 3 > SIZE || r.y + 2 > SIZE || !count(r.starter) || r.starter > 8 || !count(r.industrial) || r.industrial > 12 || r.starter === 8 && !s.kitClaimed || r.industrial === 12 && !s.industrialKit) return false;
  }
  if (s.version !== 5 || typeof s.originSeed !== "string" || s.originSeed.length < 1 || s.originSeed.length > 48 || !count(s.planet) || !count(s.highestPlanet) || s.planet > s.highestPlanet || !count(s.launches) || s.launches !== s.highestPlanet || !count(s.credits) || !count(s.orbitalRank) || !count(s.shipmentId) || !count(s.deliveredCargo) || !object(s.colonies) || Object.keys(s.colonies).length !== s.highestPlanet || !Object.entries(s.colonies).every(([k, c]) => /^\d+$/.test(k) && String(Number(k)) === k && count(Number(k)) && Number(k) <= s.highestPlanet && Number(k) !== s.planet && colonyValid(c, s))) return false;
  if (!stock(s.production) || !colonyValid(s, s) || !finite(s.time) || !count(s.mined) || !count(s.smelted) || !count(s.delivered) || typeof s.kitClaimed !== "boolean" || typeof s.industrialKit !== "boolean" || !Array.isArray(s.unlocked) || !s.unlocked.every((t) => TECH_IDS.includes(t)) || new Set(s.unlocked).size !== s.unlocked.length || !object(s.techProgress) || !TECH_IDS.every((t) => count(s.techProgress[t]) && s.techProgress[t] <= TECHS[t].cost)) return false;
  if (!s.unlocked.every((t) => TECHS[t].requires.every((p) => s.unlocked.includes(p)) && s.techProgress[t] === TECHS[t].cost) || s.research !== null && (!TECH_IDS.includes(s.research) || s.unlocked.includes(s.research) || !TECHS[s.research].requires.every((p) => s.unlocked.includes(p)))) return false;
  if (s.flight !== null) {
    const f = s.flight;
    if (!object(f) || f.from !== s.planet || f.to !== s.highestPlanet + 1 || !finite(f.elapsed) || f.elapsed >= 8 || !tile(f.x) || !tile(f.y) || !stock(f.cargo) || totalCargo(f.cargo) > 100 + s.orbitalRank * 25 || !s.machines.some((m) => m.type === "launchpad" && m.x === f.x && m.y === f.y)) return false;
  }
  return Array.isArray(s.shipments) && new Set(s.shipments.map((p) => p.id)).size === s.shipments.length && s.shipments.every((p) => object(p) && count(p.id) && p.id > 0 && p.id <= s.shipmentId && count(p.from) && count(p.to) && p.from <= s.highestPlanet && p.to <= s.highestPlanet && p.to !== p.from && finite(p.arrival) && stock(p.cargo) && totalCargo(p.cargo) > 0 && totalCargo(p.cargo) <= 100 + s.orbitalRank * 25);
}
function migrateState(value) {
  if (object(value) && value.version === 5 && Array.isArray(value.machines) && object(value.colonies)) {
    const copy = structuredClone(value), colonies = [copy, ...Object.values(copy.colonies)];
    if (colonies.some((c) => c && Array.isArray(c.machines) && c.machines.some((m) => m?.type === "launchpad" && m.size !== 2))) {
      for (const c of colonies) if (c && Array.isArray(c.machines)) {
        for (const m of c.machines) if (m?.type === "launchpad" && m.size !== 2) m.size = 1;
      }
      if (!validState(copy)) return null;
      for (const c of colonies) for (const m of c.machines) if (m.type === "launchpad" && m.size === 1) {
        const oldX = m.x, oldY = m.y;
        m.size = 2;
        const free = (x, y) => x >= 0 && y >= 0 && x + 2 <= SIZE && y + 2 <= SIZE && !overlapsPlayer({ ...m, x, y }, c.player.x, c.player.y) && !c.machines.some((n) => n !== m && x < n.x + machineSize(n) && x + 2 > n.x && y < n.y + machineSize(n) && y + 2 > n.y);
        if (!free(m.x, m.y)) {
          const cells = Array.from({ length: (SIZE - 1) ** 2 }, (_, i) => ({ x: i % (SIZE - 1), y: Math.floor(i / (SIZE - 1)) })).sort((a, b) => Math.hypot(a.x - oldX, a.y - oldY) - Math.hypot(b.x - oldX, b.y - oldY));
          const target2 = cells.find((p) => free(p.x, p.y));
          if (!target2) return null;
          m.x = target2.x;
          m.y = target2.y;
        }
        if (c === copy && copy.flight?.x === oldX && copy.flight.y === oldY) {
          copy.flight.x = m.x;
          copy.flight.y = m.y;
        }
      }
      return validState(copy) ? copy : null;
    }
  }
  if (validState(value)) return value;
  if (!object(value)) return null;
  const old = value;
  if (![2, 3, 4].includes(old.version) || !object(old.inventory) || !Array.isArray(old.machines) || !old.machines.every((m) => m && finite(m.progress) && m.progress < (old.version === 2 ? 1 : m.type === "furnace" || m.type === "lab" ? 2 : m.type === "assembler" && m.recipe !== "none" ? RECIPES[m.recipe]?.seconds ?? 0 : 1))) return null;
  const base = createState(old.seed), scientific = old.version === 4;
  const migrated = { ...base, seed: old.seed, player: old.player, inventory: { ...inventory(), ...old.inventory }, depleted: old.depleted, mined: old.mined, time: old.time, smelted: old.version === 2 ? 0 : old.smelted, delivered: old.version === 2 ? 0 : old.delivered, kitClaimed: old.version === 2 ? false : old.kitClaimed, industrialKit: scientific ? old.industrialKit : false, production: scientific ? { ...inventory(), ...old.production } : inventory(), research: scientific ? old.research : null, unlocked: scientific ? old.unlocked : [], techProgress: scientific ? { ...base.techProgress, ...old.techProgress } : base.techProgress, machines: old.machines.map((m) => old.version === 2 ? { ...machine("miner", m.x, m.y), progress: m.progress } : { ...machine(m.type, m.x, m.y, m.dir), ...m, entry: scientific ? m.entry : (m.dir + 2) % 4, recipe: scientific ? m.recipe : "gear", exporting: scientific ? m.exporting : false, branch: scientific ? m.branch : 0, cargo: inventory(), stock: { ...inventory(), ...m.stock }, output: { ...inventory(), ...m.output } }) };
  return validState(migrated) ? migrated : null;
}


// === SIMULACIÓN: recursos, máquinas, recetas, energía y progreso. ===
// Fuente: cambios/src/simulation/sim.ts
var SIZE = 96;
var CHUNK = 32;
var RESOURCES = ["iron", "copper", "coal", "stone", "titanium", "crystal"];
var NAMES = { iron: "Hierro", copper: "Cobre", coal: "Carb\xF3n", stone: "Piedra", titanium: "Titanio", crystal: "Cristal" };
var COLORS = { iron: "#9cc8df", copper: "#ec9b5b", coal: "#73788f", stone: "#d2cbb6", titanium: "#b6baf8", crystal: "#e86ffc" };
var ITEMS = [...RESOURCES, "ironPlate", "copperPlate", "gear", "wire", "circuit", "science", "steel", "advancedCircuit", "rocketFrame", "rocketEngine", "rocketFuel", "alloy", "navCore"];
var ITEM_NAMES = { ...NAMES, ironPlate: "Placa de hierro", copperPlate: "Placa de cobre", gear: "Engranaje", wire: "Cable", circuit: "Circuito", science: "Paquete cient\xEDfico", steel: "Acero", advancedCircuit: "Avi\xF3nica", rocketFrame: "Estructura espacial", rocketEngine: "Motor de cohete", rocketFuel: "Combustible s\xF3lido", alloy: "Aleaci\xF3n de titanio", navCore: "N\xFAcleo de navegaci\xF3n" };
var ITEM_COLORS = { ...COLORS, iron: "#48d9ff", copper: "#ff8e36", coal: "#a58acb", stone: "#f2d796", ironPlate: "#b5f2ff", copperPlate: "#ffbf6b", gear: "#c6d8ed", wire: "#ffbf47", circuit: "#7dffa1", science: "#ff74b2", steel: "#d5dcec", advancedCircuit: "#f4a0ff", rocketFrame: "#91d1f5", rocketEngine: "#ffad78", rocketFuel: "#e6ec85", alloy: "#d4c3ff", navCore: "#f678d2" };
var TYPES = ["miner", "belt", "furnace", "chest", "generator", "pole", "assembler", "lab", "splitter", "launchpad", "inserter", "undergroundIn", "undergroundOut"];
var DIRECTIONS = [{ x: 1, y: 0, label: "Este \u2192" }, { x: 0, y: 1, label: "Sur \u2193" }, { x: -1, y: 0, label: "Oeste \u2190" }, { x: 0, y: -1, label: "Norte \u2191" }];
var MACHINE_NAMES = { miner: "Minera", belt: "Cinta", furnace: "Horno", chest: "Cofre", generator: "Generador", pole: "Poste", assembler: "Ensambladora", lab: "Laboratorio", splitter: "Divisor", launchpad: "Plataforma espacial", inserter: "Brazo rob\xF3tico", undergroundIn: "Entrada subterr\xE1nea", undergroundOut: "Salida subterr\xE1nea" };
var COSTS = { miner: { iron: 10, stone: 5 }, belt: { stone: 1 }, furnace: { iron: 6, stone: 10 }, chest: { iron: 2, stone: 4 }, generator: { iron: 8, stone: 8 }, pole: { copper: 2, stone: 2 }, assembler: { iron: 8, stone: 6 }, lab: { iron: 8, copper: 8, stone: 5 }, splitter: { ironPlate: 2, stone: 2 }, launchpad: { steel: 6, circuit: 4, stone: 20 }, inserter: { ironPlate: 2, gear: 1, copperPlate: 1 }, undergroundIn: { stone: 2, ironPlate: 1 }, undergroundOut: { stone: 2, ironPlate: 1 } };
var RECIPES = {
  gear: { name: "Engranajes", input: { ironPlate: 2 }, output: { gear: 1 }, seconds: 2, tech: null },
  wire: { name: "Cables", input: { copperPlate: 1 }, output: { wire: 2 }, seconds: 1, tech: null },
  science: { name: "Paquetes cient\xEDficos", input: { gear: 1, wire: 2 }, output: { science: 1 }, seconds: 3, tech: null },
  circuit: { name: "Circuitos", input: { ironPlate: 1, wire: 2 }, output: { circuit: 1 }, seconds: 3, tech: "electronics" },
  steel: { name: "Acero", input: { ironPlate: 3, coal: 1 }, output: { steel: 1 }, seconds: 3, tech: "astronautics" },
  advancedCircuit: { name: "Avi\xF3nica", input: { circuit: 2, wire: 2 }, output: { advancedCircuit: 1 }, seconds: 3, tech: "astronautics" },
  rocketFrame: { name: "Estructuras espaciales", input: { steel: 2, gear: 1 }, output: { rocketFrame: 1 }, seconds: 3, tech: "astronautics" },
  rocketEngine: { name: "Motores de cohete", input: { steel: 2, gear: 2, circuit: 1 }, output: { rocketEngine: 1 }, seconds: 4, tech: "astronautics" },
  rocketFuel: { name: "Combustible s\xF3lido", input: { coal: 3, copperPlate: 1 }, output: { rocketFuel: 1 }, seconds: 2, tech: "astronautics" },
  alloy: { name: "Aleaci\xF3n de titanio", input: { titanium: 2, steel: 1 }, output: { alloy: 1 }, seconds: 4, tech: "interstellar" },
  navCore: { name: "N\xFAcleos de navegaci\xF3n", input: { crystal: 2, advancedCircuit: 1 }, output: { navCore: 1 }, seconds: 5, tech: "interstellar" }
};
var TECHS = {
  electronics: { name: "Electr\xF3nica", cost: 8, requires: [], description: "Desbloquea la receta de circuitos." },
  logistics: { name: "Log\xEDstica avanzada", cost: 12, requires: ["electronics"], description: "Desbloquea divisores y duplica la velocidad de las cintas." },
  smelting: { name: "Fundici\xF3n mejorada", cost: 12, requires: ["electronics"], description: "Los hornos trabajan un 50 % m\xE1s r\xE1pido con la misma cantidad de carb\xF3n por placa." },
  industry: { name: "Industria eficiente", cost: 20, requires: ["logistics", "smelting"], description: "Ensambladoras 50 % m\xE1s r\xE1pidas y generadores con 50 % m\xE1s capacidad." },
  astronautics: { name: "Astron\xE1utica", cost: 12, requires: ["industry"], description: "Acero, componentes de cohete, combustible y plataforma espacial." },
  interstellar: { name: "Navegaci\xF3n estelar", cost: 16, requires: ["astronautics"], description: "Aleaci\xF3n de titanio y n\xFAcleos de cristal para completar la campa\xF1a y explorar sectores infinitos." }
};
var TECH_IDS = Object.keys(TECHS);
var DEMAND = { miner: 5, assembler: 10, lab: 12, launchpad: 20, inserter: 2 };
var PLAYER_CLEARANCE = 0.77;
function inventory() {
  return Object.fromEntries(ITEMS.map((i) => [i, 0]));
}
var total = (stock2) => ITEMS.reduce((n, i) => n + stock2[i], 0);
function machineSize(m) {
  return m.type === "launchpad" ? m.size ?? 2 : 1;
}
function distanceToMachine(m, x, y) {
  const size = m.type ? machineSize(m) : 1;
  return Math.hypot(Math.max(m.x + 0.5 - x, 0, x - (m.x + size - 0.5)), Math.max(m.y + 0.5 - y, 0, y - (m.y + size - 0.5)));
}
function overlapsPlayer(m, x, y, clearance = PLAYER_CLEARANCE) {
  const size = machineSize(m);
  return Math.abs(x - m.x - size / 2) < size / 2 + clearance - 0.5 && Math.abs(y - m.y - size / 2) < size / 2 + clearance - 0.5;
}
function machine(type, x, y, dir2 = 0) {
  return { type, x, y, ...type === "launchpad" ? { size: 2 } : {}, dir: dir2, entry: (dir2 + 2) % 4, progress: 0, stock: inventory(), output: inventory(), fuel: 0, produced: 0, recipe: "gear", exporting: false, branch: 0, cargo: inventory() };
}
function hash(x, y, seed) {
  let n = Math.imul(x + seed, 374761393) ^ Math.imul(y + 1, 668265263);
  n = Math.imul(n ^ n >>> 13, 1274126177);
  return ((n ^ n >>> 16) >>> 0) / 4294967296;
}
function seedNumber(seed) {
  let n = 0;
  for (const c of seed) n = Math.imul(n, 31) + c.charCodeAt(0) | 0;
  return n;
}
function createState(seed = "aurora-01") {
  return { version: 5, seed, player: { x: 48.5, y: 48.5 }, inventory: inventory(), machines: [], depleted: {}, mined: 0, time: 0, smelted: 0, delivered: 0, kitClaimed: false, industrialKit: false, research: null, unlocked: [], techProgress: Object.fromEntries(TECH_IDS.map((id) => [id, 0])), production: inventory(), originSeed: seed, planet: 0, highestPlanet: 0, colonies: {}, flight: null, launches: 0, credits: 0, orbitalRank: 0, shipments: [], shipmentId: 0, deliveredCargo: 0 };
}
var World = class {
  chunks = /* @__PURE__ */ new Map();
  machineIndex = /* @__PURE__ */ new Map();
  indexedMachines = null;
  indexedLength = -1;
  seed;
  state;
  constructor(state) {
    this.state = state;
    this.seed = seedNumber(state.seed);
    this.ensureWreck();
  }
  ensureWreck() {
    const s = this.state;
    if (s.salvage || s.kitClaimed && s.industrialKit) return;
    const colony = s.planet === 0 ? s : s.colonies[0];
    if (!colony) return;
    const cells = Array.from({ length: (SIZE - 2) * (SIZE - 1) }, (_, i) => ({ x: i % (SIZE - 2), y: Math.floor(i / (SIZE - 2)) })).sort((a, b) => Math.hypot(a.x - 47, a.y - 46) - Math.hypot(b.x - 47, b.y - 46));
    const p = cells.find((p2) => !(colony.player.x > p2.x - 0.27 && colony.player.x < p2.x + 3.27 && colony.player.y > p2.y - 0.27 && colony.player.y < p2.y + 2.27) && !colony.machines.some((m) => p2.x < m.x + machineSize(m) && p2.x + 3 > m.x && p2.y < m.y + machineSize(m) && p2.y + 2 > m.y));
    if (p) s.salvage = { ...p, starter: 0, industrial: 0 };
  }
  wreck() {
    return this.state.planet === 0 && (!this.state.kitClaimed || !this.state.industrialKit) ? this.state.salvage ?? null : null;
  }
  wreckAt(x, y) {
    const r = this.wreck();
    return !!r && x >= r.x && x < r.x + 3 && y >= r.y && y < r.y + 2;
  }
  wreckBlocksPlayer(x, y) {
    const r = this.wreck();
    return !!r && x > r.x - 0.27 && x < r.x + 3.27 && y > r.y - 0.27 && y < r.y + 2.27;
  }
  canSalvage() {
    const r = this.wreck(), p = this.state.player;
    return !!r && !this.state.flight && Math.hypot(Math.max(r.x + 0.5 - p.x, 0, p.x - r.x - 2.5), Math.max(r.y + 0.5 - p.y, 0, p.y - r.y - 1.5)) <= 2;
  }
  // Recupera recursos de la nave accidentada.
  salvageHit() {
    const r = this.wreck();
    if (!r || !this.canSalvage()) return null;
    let drop;
    if (!this.state.kitClaimed) {
      const i = r.starter++;
      drop = { iron: 4, stone: 5, coal: i < 4 ? 2 : 1, ...i < 6 ? { copper: 1 } : {} };
      if (r.starter === 8) this.state.kitClaimed = true;
    } else {
      const i = r.industrial++;
      drop = { iron: 3, stone: i < 11 ? 3 : 2, coal: i < 4 ? 2 : 1, copper: i < 6 ? 2 : 1, ironPlate: 1, copperPlate: 1 };
      if (r.industrial === 12) this.state.industrialKit = true;
    }
    for (const [item, n] of Object.entries(drop)) this.state.inventory[item] += n;
    return drop;
  }
  planet() {
    return planetInfo(this.state.planet, this.state.originSeed);
  }
  batchSize() {
    return orbitalBatch(this.state.orbitalRank);
  }
  productivity() {
    return 1 + this.state.orbitalRank * 0.25 + Math.max(0, this.state.highestPlanet - 2) * 0.1;
  }
  outputLimit(m) {
    return (m.type === "assembler" ? 10 : 5) * this.batchSize();
  }
  requirements() {
    return rocketRequirements(this.state.highestPlanet);
  }
  rocketLoaded(m) {
    return m.type === "launchpad" && Object.entries(this.requirements()).every(([i, n]) => m.stock[i] >= n);
  }
  cargoCapacity() {
    return 100 + this.state.orbitalRank * 25;
  }
  // Inicia el lanzamiento si se cumplen los requisitos.
  startLaunch(m) {
    if (this.state.flight) return "Ya hay un lanzamiento en curso.";
    if (!this.state.machines.includes(m) || m.type !== "launchpad" || !this.inReach(m)) return "Acercate a una plataforma espacial.";
    if (!this.hasTech("astronautics")) return "Investig\xE1 Astron\xE1utica.";
    if (!this.rocketLoaded(m) || m.progress < 6 - 1e-8) return "Faltan componentes o el ensamblaje todav\xEDa no termin\xF3.";
    if (!(this.power().ratios.get(m) ?? 0)) return "La plataforma necesita electricidad para lanzar.";
    for (const [i, n] of Object.entries(this.requirements())) m.stock[i] -= n;
    this.state.flight = { from: this.state.planet, to: this.state.highestPlanet + 1, x: m.x, y: m.y, elapsed: 0, cargo: { ...m.cargo } };
    m.cargo = inventory();
    m.progress = 0;
    return null;
  }
  loadCargo(m, item) {
    if (this.state.flight) return "Esper\xE1 a que termine el lanzamiento.";
    if (m.type !== "launchpad" || !this.state.machines.includes(m) || !this.inReach(m)) return "Acercate a la plataforma.";
    const n = Math.min(5, this.state.inventory[item], this.cargoCapacity() - total(m.cargo));
    if (n <= 0) return "Carga completa o mochila sin ese material.";
    m.cargo[item] += n;
    this.state.inventory[item] -= n;
    return null;
  }
  unloadCargo(m) {
    if (this.state.flight || !this.state.machines.includes(m) || !this.inReach(m)) return "Acercate a la plataforma fuera del lanzamiento.";
    for (const i of ITEMS) {
      this.state.inventory[i] += m.cargo[i];
      m.cargo[i] = 0;
    }
    return null;
  }
  loadRocketFromInventory(m) {
    if (this.state.flight || m.type !== "launchpad" || !this.state.machines.includes(m) || !this.inReach(m)) return "Acercate a la plataforma fuera del lanzamiento.";
    let loaded = 0;
    for (const [i, n] of Object.entries(this.requirements())) {
      const item = i, amount = Math.min(n - m.stock[item], this.state.inventory[item]);
      if (amount > 0) {
        m.stock[item] += amount;
        this.state.inventory[item] -= amount;
        loaded += amount;
      }
    }
    return loaded ? null : "No hay componentes pendientes en la mochila.";
  }
  archive() {
    this.state.colonies[this.state.planet] = structuredClone({ seed: this.state.seed, player: this.state.player, inventory: this.state.inventory, machines: this.state.machines, depleted: this.state.depleted });
  }
  activate(index, cargo = inventory()) {
    const saved = this.state.colonies[index];
    const landing = inventory();
    Object.assign(landing, { iron: 30, copper: 20, stone: 40, coal: 20, ironPlate: 12, copperPlate: 12 });
    const colony = saved ?? { seed: index === 0 ? this.state.originSeed : `${this.state.originSeed}/sector-${index}`, player: { x: 48.5, y: 48.5 }, inventory: landing, machines: [], depleted: {} };
    this.state.planet = index;
    this.state.seed = colony.seed;
    this.state.player = colony.player;
    this.state.inventory = colony.inventory;
    this.state.machines = colony.machines;
    this.state.depleted = colony.depleted;
    for (const i of ITEMS) this.state.inventory[i] += cargo[i];
    delete this.state.colonies[index];
    this.seed = seedNumber(colony.seed);
    this.chunks.clear();
  }
  visit(index) {
    if (this.state.flight) return "Esper\xE1 a que termine el lanzamiento.";
    if (index === this.state.planet) return "Ya est\xE1s en esa colonia.";
    if (!Number.isSafeInteger(index) || !this.state.colonies[index]) return "Ese planeta todav\xEDa no est\xE1 descubierto.";
    this.archive();
    this.activate(index);
    return null;
  }
  // Envía materiales entre colonias.
  sendShipment(to, item, amount) {
    if (this.state.flight) return "Esper\xE1 a que termine el lanzamiento.";
    if (!Number.isSafeInteger(to) || to === this.state.planet || !this.state.colonies[to]) return "Eleg\xED otra colonia descubierta.";
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > this.cargoCapacity()) return "La cantidad supera la capacidad de carga.";
    if (this.state.inventory[item] < amount || this.state.inventory.rocketFuel < 2 + (item === "rocketFuel" ? amount : 0)) return "Necesit\xE1s los materiales de carga y 2 combustibles s\xF3lidos para el env\xEDo.";
    const cargo = inventory();
    cargo[item] = amount;
    this.state.inventory[item] -= amount;
    this.state.inventory.rocketFuel -= 2;
    this.state.shipments.push({ id: ++this.state.shipmentId, from: this.state.planet, to, arrival: this.state.time + 10, cargo });
    return null;
  }
  buyOrbitalUpgrade() {
    const cost = 10 * (this.state.orbitalRank + 1);
    if (this.state.flight) return "Esper\xE1 a que termine el lanzamiento.";
    if (this.state.credits < cost) return `Necesit\xE1s ${cost} cr\xE9ditos orbitales.`;
    this.state.credits -= cost;
    this.state.orbitalRank++;
    return null;
  }
  tile(x, y) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return { resource: null, amount: 0 };
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK), key = `${cx},${cy}`;
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = [];
      for (let j = 0; j < CHUNK; j++) for (let i = 0; i < CHUNK; i++) chunk.push(this.generate(cx * CHUNK + i, cy * CHUNK + j));
      this.chunks.set(key, chunk);
    }
    const t = chunk[y % CHUNK * CHUNK + x % CHUNK];
    return { resource: t.resource, amount: Math.max(0, t.amount - (this.state.depleted[`${x},${y}`] ?? 0)) };
  }
  generate(x, y) {
    const p = this.planet(), t = this.generateBase(x, y);
    let rare = null;
    if (p.rare) {
      if (p.rare !== "crystal" && Math.hypot(x - 45, y - 44) < 1.8) rare = "titanium";
      if (p.rare !== "titanium" && Math.hypot(x - 54, y - 52) < 1.8) rare = "crystal";
      if (t.resource && hash(Math.floor(x / 10), Math.floor(y / 10), this.seed + 77) > 0.67) rare = p.rare === "both" ? hash(x, y, this.seed) > 0.5 ? "titanium" : "crystal" : p.rare;
    }
    return { resource: rare ?? t.resource, amount: Math.floor((rare ? 300 : t.amount) * p.richness) };
  }
  generateBase(x, y) {
    if (this.state.originSeed.startsWith("m4:")) {
      const starts2 = [{ x: 58, y: 48, r: "iron" }, { x: 43, y: 58, r: "stone" }, { x: 28, y: 44, r: "copper" }, { x: 51, y: 28, r: "coal" }];
      for (const p of starts2) if (Math.hypot(x - p.x, y - p.y) < 4.5) return { resource: p.r, amount: 350 + Math.floor(hash(x, y, this.seed) * 300) };
      if (Math.hypot(x - 48, y - 48) < 22) return { resource: null, amount: 0 };
      for (let gy = Math.floor(y / 24) - 1; gy <= Math.floor(y / 24) + 1; gy++) for (let gx = Math.floor(x / 24) - 1; gx <= Math.floor(x / 24) + 1; gx++) {
        const h2 = hash(gx, gy, this.seed), px = gx * 24 + 10 + hash(gx + 300, gy, this.seed) * 4, py = gy * 24 + 10 + hash(gx, gy + 300, this.seed) * 4;
        if (h2 > 0.5 && Math.hypot(x - px, y - py) < 5.2 + h2 * 0.8) return { resource: RESOURCES[Math.floor(hash(gx + 99, gy + 99, this.seed) * 4)], amount: 350 + Math.floor(h2 * 400) };
      }
      return { resource: null, amount: 0 };
    }
    if (this.state.originSeed.startsWith("m3:")) {
      const starts2 = [{ x: 58, y: 48, r: "iron" }, { x: 43, y: 58, r: "stone" }, { x: 38, y: 44, r: "copper" }, { x: 51, y: 38, r: "coal" }];
      for (const p of starts2) if (Math.hypot(x - p.x, y - p.y) < 4.5) return { resource: p.r, amount: 350 + Math.floor(hash(x, y, this.seed) * 300) };
      if (Math.hypot(x - 48, y - 48) < 18) return { resource: null, amount: 0 };
      for (let gy = Math.floor(y / 24) - 1; gy <= Math.floor(y / 24) + 1; gy++) for (let gx = Math.floor(x / 24) - 1; gx <= Math.floor(x / 24) + 1; gx++) {
        const h2 = hash(gx, gy, this.seed);
        const px = gx * 24 + 10 + hash(gx + 300, gy, this.seed) * 4, py = gy * 24 + 10 + hash(gx, gy + 300, this.seed) * 4;
        if (h2 > 0.5 && Math.hypot(x - px, y - py) < 5.2 + h2 * 0.8) return { resource: RESOURCES[Math.floor(hash(gx + 99, gy + 99, this.seed) * 4)], amount: 350 + Math.floor(h2 * 400) };
      }
      return { resource: null, amount: 0 };
    }
    if (this.state.originSeed.startsWith("m2:")) {
      const starts2 = [{ x: 54, y: 48, r: "iron" }, { x: 45, y: 54, r: "stone" }, { x: 41, y: 46, r: "copper" }, { x: 51, y: 41, r: "coal" }];
      for (const p of starts2) if (Math.hypot(x - p.x, y - p.y) < 3.4) return { resource: p.r, amount: 350 + Math.floor(hash(x, y, this.seed) * 300) };
      if (Math.hypot(x - 48, y - 48) < 12) return { resource: null, amount: 0 };
      for (let gy = Math.floor(y / 16) - 1; gy <= Math.floor(y / 16) + 1; gy++) for (let gx = Math.floor(x / 16) - 1; gx <= Math.floor(x / 16) + 1; gx++) {
        const h2 = hash(gx, gy, this.seed);
        const px = gx * 16 + 3 + hash(gx + 300, gy, this.seed) * 10, py = gy * 16 + 3 + hash(gx, gy + 300, this.seed) * 10;
        if (h2 > 0.5 && Math.hypot(x - px, y - py) < 3.6 + h2 * 1.4) return { resource: RESOURCES[Math.floor(hash(gx + 99, gy + 99, this.seed) * 4)], amount: 350 + Math.floor(h2 * 400) };
      }
      return { resource: null, amount: 0 };
    }
    const starts = [{ x: 51, y: 48, r: "iron" }, { x: 46, y: 51, r: "stone" }, { x: 43, y: 46, r: "copper" }, { x: 51, y: 43, r: "coal" }];
    for (const p of starts) if (Math.hypot(x - p.x, y - p.y) < 1.8) return { resource: p.r, amount: 150 + Math.floor(hash(x, y, this.seed) * 180) };
    for (let gy = Math.floor(y / 10) - 1; gy <= Math.floor(y / 10) + 1; gy++) for (let gx = Math.floor(x / 10) - 1; gx <= Math.floor(x / 10) + 1; gx++) {
      const h2 = hash(gx, gy, this.seed);
      const px = gx * 10 + hash(gx + 300, gy, this.seed) * 8, py = gy * 10 + hash(gx, gy + 300, this.seed) * 8;
      if (h2 > 0.32 && Math.hypot(x - px, y - py) < 1.5 + h2 * 2) return { resource: RESOURCES[Math.floor(hash(gx + 99, gy + 99, this.seed) * 4)], amount: 100 + Math.floor(h2 * 400) };
    }
    return { resource: null, amount: 0 };
  }
  // Extrae un recurso del terreno y reduce sus reservas.
  extract(x, y) {
    if (this.state.flight || this.wreckAt(x, y)) return false;
    const t = this.tile(x, y);
    if (!t.resource || t.amount <= 0) return false;
    const key = `${x},${y}`;
    this.state.depleted[key] = (this.state.depleted[key] ?? 0) + 1;
    this.state.inventory[t.resource]++;
    this.state.production[t.resource]++;
    this.state.mined++;
    return true;
  }
  nearest() {
    const p = this.state.player;
    let best = null, distance = 2;
    for (let y = Math.floor(p.y) - 2; y <= Math.floor(p.y) + 2; y++) for (let x = Math.floor(p.x) - 2; x <= Math.floor(p.x) + 2; x++) {
      const t = this.tile(x, y), d = Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y);
      if (t.resource && t.amount > 0 && d < distance && !this.at(x, y) && !this.wreckAt(x, y)) {
        best = { x, y };
        distance = d;
      }
    }
    return best;
  }
  at(x, y) {
    const machines = this.state.machines;
    if (this.indexedMachines !== machines || this.indexedLength !== machines.length) {
      this.machineIndex.clear();
      for (const m of machines) for (let dy = 0; dy < machineSize(m); dy++) for (let dx = 0; dx < machineSize(m); dx++) this.machineIndex.set(`${m.x + dx},${m.y + dy}`, m);
      this.indexedMachines = machines;
      this.indexedLength = machines.length;
    }
    return this.machineIndex.get(`${x},${y}`);
  }
  hasTech(id) {
    return this.state.unlocked.includes(id);
  }
  recipeUnlocked(id) {
    const t = RECIPES[id].tech;
    return !t || this.hasTech(t);
  }
  beltDuration() {
    return this.hasTech("logistics") ? 0.2 : 0.4;
  }
  undergroundExit(m) {
    if (m.type !== "undergroundIn") return;
    const d = DIRECTIONS[m.dir];
    for (let n = 2; n <= 6; n++) {
      const next = this.at(m.x + d.x * n, m.y + d.y * n);
      if (next?.type === "undergroundIn" && next.dir === m.dir) return;
      if (next?.type === "undergroundOut" && next.dir === m.dir) return next;
    }
  }
  beltInputs(m) {
    const inputs = [];
    for (let side = 0; side < 4; side++) {
      if (side === m.dir || m.type === "undergroundIn" && side !== (m.dir + 2) % 4 || m.type === "undergroundOut") continue;
      const d = DIRECTIONS[side], n = this.at(m.x + d.x, m.y + d.y);
      if (!n || n.type === "undergroundIn" || n.type === "pole" || n.type === "lab" || n.type === "generator" || n.type === "chest" && !n.exporting) continue;
      const exits = n.type === "splitter" ? [n.dir, (n.dir + 1) % 4] : [n.dir];
      if (exits.some((dir2) => n.x + DIRECTIONS[dir2].x === m.x && n.y + DIRECTIONS[dir2].y === m.y)) inputs.push(side);
    }
    return inputs;
  }
  extendBelt(from, to, end) {
    const dx = to.x - from.x, dy = to.y - from.y;
    if (Math.abs(dx) + Math.abs(dy) !== 1) return "Arrastr\xE1 por casillas vecinas para trazar la cinta.";
    const previous = this.at(from.x, from.y);
    if (previous?.type !== "belt" || !this.inReach(previous)) return "La cinta anterior est\xE1 fuera de alcance.";
    const existing = this.at(to.x, to.y);
    if (existing && (existing.type !== "belt" || !this.inReach(existing))) return "La casilla siguiente est\xE1 ocupada o fuera de alcance.";
    const error = existing ? null : this.build(to.x, to.y, "belt", end);
    if (error) return error;
    previous.dir = DIRECTIONS.findIndex((d) => d.x === dx && d.y === dy);
    return null;
  }
  inReach(m) {
    return distanceToMachine(m, this.state.player.x, this.state.player.y) <= 4;
  }
  missingMaterials(type) {
    return Object.entries(COSTS[type]).filter(([i, n]) => this.state.inventory[i] < n).map(([i, n]) => `${ITEM_NAMES[i]} ${this.state.inventory[i]}/${n}`).join(" \xB7 ");
  }
  // Comprueba alcance, espacio y materiales antes de construir.
  placement(x, y, type = "miner") {
    const s = this.state, t = this.tile(x, y), size = machineSize({ type });
    if (s.flight) return "Esper\xE1 a que termine el lanzamiento.";
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x + size > SIZE || y + size > SIZE) return "Fuera del mapa: la base debe entrar completa.";
    for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) if (this.wreckAt(x + dx, y + dy)) return "Desarm\xE1 primero la nave: acercate y manten\xE9 E.";
    else if (this.at(x + dx, y + dy)) return "La casilla est\xE1 ocupada.";
    if (type === "splitter" && !this.hasTech("logistics")) return "Investig\xE1 Log\xEDstica avanzada para desbloquear el divisor.";
    if (type === "launchpad" && !this.hasTech("astronautics")) return "Investig\xE1 Astron\xE1utica para desbloquear la plataforma.";
    if (type === "miner" && (!t.resource || t.amount <= 0)) return t.resource ? "Este yacimiento est\xE1 agotado. Eleg\xED otra casilla." : "La minera necesita una mena de hierro, cobre, carb\xF3n, piedra, titanio o cristal.";
    if (!this.inReach({ x, y, type })) return "Acercate: el alcance es de 4 casillas.";
    if (!["belt", "splitter", "pole", "undergroundIn", "undergroundOut"].includes(type) && overlapsPlayer({ x, y, type }, s.player.x, s.player.y)) return "El personaje est\xE1 demasiado cerca. Movete un poco para dejar libre la casilla.";
    const missing = this.missingMaterials(type);
    if (missing) return `Faltan materiales: ${missing}.`;
    return null;
  }
  // Construye una máquina si su ubicación es válida.
  build(x, y, type = "miner", dir2 = 0) {
    const error = this.placement(x, y, type);
    if (error) return error;
    for (const [i, n] of Object.entries(COSTS[type])) this.state.inventory[i] -= n;
    const built = machine(type, x, y, dir2);
    if (type === "assembler") built.recipe = "none";
    this.state.machines.push(built);
    this.indexedLength = -1;
    return null;
  }
  claimKit() {
    if (this.state.kitClaimed) return false;
    this.state.kitClaimed = true;
    this.state.inventory.iron += 20;
    this.state.inventory.stone += 25;
    this.state.inventory.coal += 8;
    return true;
  }
  claimIndustrialKit() {
    if (this.state.industrialKit) return false;
    this.state.industrialKit = true;
    for (const [i, n] of Object.entries({ iron: 48, copper: 24, stone: 50, coal: 20, ironPlate: 12, copperPlate: 12 })) this.state.inventory[i] += n;
    return true;
  }
  // Desmonta una máquina y recupera su contenido.
  remove(m) {
    if (this.state.flight) return "Esper\xE1 a que termine el lanzamiento.";
    if (!this.state.machines.includes(m) || !this.inReach(m)) return "Acercate para desmontar la m\xE1quina.";
    for (const i of ITEMS) this.state.inventory[i] += m.stock[i] + m.output[i] + m.cargo[i] + (COSTS[m.type][i] ?? 0);
    this.state.machines.splice(this.state.machines.indexOf(m), 1);
    this.indexedLength = -1;
    return null;
  }
  collect(m) {
    if (this.state.flight) return "Esper\xE1 a que termine el lanzamiento.";
    if (!this.state.machines.includes(m) || !this.inReach(m)) return "Acercate para recoger los materiales.";
    const stock2 = m.type === "chest" ? m.stock : m.output;
    for (const i of ITEMS) {
      this.state.inventory[i] += stock2[i];
      stock2[i] = 0;
    }
    return null;
  }
  loadFurnace(m, item) {
    if (m.type !== "furnace") return "Seleccion\xE1 un horno.";
    return this.loadMachine(m, item);
  }
  inputLimit(m, item) {
    const batch = this.batchSize();
    if (m.type === "belt" || m.type === "undergroundIn" || m.type === "undergroundOut") return batch;
    if (m.type === "splitter") return 2 * batch;
    if (m.type === "chest") return 200 * batch;
    if (m.type === "furnace") return ["iron", "copper", "coal"].includes(item) ? 5 * batch : 0;
    if (m.type === "generator") return item === "coal" ? 10 : 0;
    if (m.type === "lab") return item === "science" ? 30 * batch : 0;
    if (m.type === "assembler") return m.recipe !== "none" && item in RECIPES[m.recipe].input ? 20 * batch : 0;
    if (m.type === "launchpad") return this.requirements()[item] ?? 0;
    return 0;
  }
  accepts(m, item) {
    const cap = this.inputLimit(m, item);
    return cap > 0 && (["belt", "splitter", "chest", "undergroundIn", "undergroundOut"].includes(m.type) ? total(m.stock) < cap : m.stock[item] < cap);
  }
  loadMachine(m, item) {
    if (this.state.flight) return "Esper\xE1 a que termine el lanzamiento.";
    if (!this.state.machines.includes(m) || !this.inReach(m)) return "Acercate a la m\xE1quina para cargar materiales.";
    const cap = this.inputLimit(m, item), used = ["chest", "belt", "splitter", "undergroundIn", "undergroundOut"].includes(m.type) ? total(m.stock) : m.stock[item];
    const amount = Math.min(5, cap - used, this.state.inventory[item]);
    if (amount <= 0) return "Material incompatible, entrada llena o mochila sin existencias.";
    this.state.inventory[item] -= amount;
    m.stock[item] += amount;
    return null;
  }
  collectInputs(m) {
    if (this.state.flight) return "Esper\xE1 a que termine el lanzamiento.";
    if (!this.state.machines.includes(m) || !this.inReach(m)) return "Acercate para recuperar la entrada.";
    for (const i of ITEMS) {
      this.state.inventory[i] += m.stock[i];
      m.stock[i] = 0;
    }
    m.progress = 0;
    return null;
  }
  // Cambia la receta de una máquina.
  setRecipe(m, id) {
    if (this.state.flight) return "Esper\xE1 a que termine el lanzamiento.";
    if (m.type !== "assembler" || !this.state.machines.includes(m) || !this.inReach(m)) return "Acercate a la ensambladora.";
    if (!this.recipeUnlocked(id)) return `Investig\xE1 ${TECHS[RECIPES[id].tech].name} para usar esa receta.`;
    m.recipe = id;
    m.progress = 0;
    return null;
  }
  // Inicia una investigación disponible.
  startResearch(id) {
    if (this.hasTech(id)) return "Esa tecnolog\xEDa ya est\xE1 investigada.";
    if (!TECHS[id].requires.every((t) => this.hasTech(t))) return "Complet\xE1 las tecnolog\xEDas anteriores.";
    this.state.research = id;
    return null;
  }
  transferStock(m) {
    return ["belt", "splitter", "chest", "undergroundIn", "undergroundOut"].includes(m.type) ? m.stock : m.output;
  }
  inserterEnds(m) {
    const d = DIRECTIONS[m.dir];
    return { from: this.at(m.x - d.x, m.y - d.y), to: this.at(m.x + d.x, m.y + d.y) };
  }
  inserterItem(m) {
    const { from, to } = this.inserterEnds(m);
    if (!from || !to || from === to || from.type === "inserter" || to.type === "inserter") return void 0;
    if (["belt", "splitter"].includes(to.type) && to.x + DIRECTIONS[to.dir].x === m.x && to.y + DIRECTIONS[to.dir].y === m.y) return void 0;
    return ITEMS.find((i) => this.transferStock(from)[i] > 0 && this.accepts(to, i));
  }
  canWork(m) {
    if (m.type === "inserter") return !!this.inserterItem(m);
    if (m.type === "miner") return total(m.output) < this.outputLimit(m) && this.tile(m.x, m.y).amount > 0;
    if (m.type === "lab") return !!this.state.research && m.stock.science > 0;
    if (m.type === "assembler") {
      if (m.recipe === "none") return false;
      const r = RECIPES[m.recipe];
      return this.recipeUnlocked(m.recipe) && Object.entries(r.input).every(([i, n]) => m.stock[i] >= n) && total(m.output) + Object.values(r.output).reduce((a, b) => a + b, 0) <= this.outputLimit(m);
    }
    if (m.type === "launchpad") return this.rocketLoaded(m) && m.progress < 6 - 1e-8;
    return false;
  }
  // Calcula las redes eléctricas, generación y consumo.
  power() {
    const modifier = this.planet();
    const demandFor = (m) => (DEMAND[m.type] ?? 0) * (m.type === "miner" ? modifier.mining : 1);
    const nodes = this.state.machines.filter((m) => m.type === "generator" || m.type === "pole");
    const parents = nodes.map((_, i) => i), root = (i) => parents[i] === i ? i : root(parents[i]);
    const links = [];
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) if (Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) <= 6) {
      parents[root(i)] = root(j);
      links.push({ from: nodes[i], to: nodes[j] });
    }
    const groups = /* @__PURE__ */ new Map();
    nodes.forEach((m, i) => {
      const key = root(i), group = groups.get(key) ?? { nodes: [], consumers: [], capacity: 0, demand: 0 };
      group.nodes.push(m);
      if (m.type === "generator" && (m.stock.coal > 0 || m.fuel > 1e-8)) group.capacity += (this.hasTech("industry") ? 90 : 60) * modifier.power;
      groups.set(key, group);
    });
    const ratios = /* @__PURE__ */ new Map();
    for (const m of this.state.machines) {
      if (!DEMAND[m.type]) continue;
      ratios.set(m, 0);
      const nearby = nodes.map((n, i) => ({ node: n, key: root(i) })).filter(({ node }) => distanceToMachine(m, node.x + 0.5, node.y + 0.5) <= 4).sort((a, b) => (groups.get(b.key)?.capacity ?? 0) - (groups.get(a.key)?.capacity ?? 0));
      if (!nearby.length) continue;
      const group = groups.get(nearby[0].key);
      group.consumers.push(m);
      if (this.canWork(m)) group.demand += demandFor(m);
    }
    const generators = /* @__PURE__ */ new Map();
    let capacity = 0, demand = 0, generated = 0;
    for (const group of groups.values()) {
      const ratio = group.demand > 0 ? Math.min(1, group.capacity / group.demand) : group.capacity > 0 ? 1 : 0;
      for (const m of group.consumers) ratios.set(m, ratio);
      for (const m of group.nodes) if (m.type === "generator") generators.set(m, group.demand > 0 && group.capacity > 0 && (m.fuel > 1e-8 || m.stock.coal > 0));
      capacity += group.capacity;
      demand += group.demand;
      generated += Math.min(group.capacity, group.demand);
    }
    for (const m of this.state.machines) if (DEMAND[m.type] && this.canWork(m) && !nodes.some((n) => distanceToMachine(m, n.x + 0.5, n.y + 0.5) <= 4)) demand += demandFor(m);
    return { capacity, demand, generated, ratios, generators, links };
  }
  status(m, power) {
    if (m.type === "inserter") {
      const { from, to } = this.inserterEnds(m);
      if (!from) return "Sin conexi\xF3n de entrada";
      if (!to) return "Sin conexi\xF3n de salida";
      if (!ITEMS.some((i) => this.transferStock(from)[i] > 0)) return "Esperando material";
      if (!this.inserterItem(m)) return "Salida bloqueada";
      const ratio = (power ?? this.power()).ratios.get(m) ?? 0;
      return ratio === 0 ? "Sin electricidad" : ratio < 1 ? "Red sobrecargada" : "Transfiriendo materiales";
    }
    if (m.type === "launchpad" && this.state.flight) return "Lanzamiento en curso";
    if (m.type === "launchpad" && !this.rocketLoaded(m)) return "Faltan componentes de cohete";
    if (m.type === "miner") {
      if (this.tile(m.x, m.y).amount <= 0) return "Yacimiento agotado";
      if (total(m.output) >= this.outputLimit(m)) return "Salida llena";
    }
    if (DEMAND[m.type]) {
      if (m.type === "assembler" && m.recipe === "none") return "Eleg\xED una receta";
      if (m.type === "assembler" && !this.recipeUnlocked(m.recipe)) return "Receta bloqueada";
      if (m.type === "lab" && !this.state.research) return "Eleg\xED una investigaci\xF3n";
      if (m.type === "lab" && m.stock.science === 0) return "Sin paquetes cient\xEDficos";
      if (m.type === "assembler" && !this.canWork(m)) return total(m.output) + Object.values(RECIPES[m.recipe].output).reduce((a, b) => a + b, 0) > this.outputLimit(m) ? "Salida llena" : "Faltan ingredientes";
      const ratio = (power ?? this.power()).ratios.get(m) ?? 0;
      if (ratio === 0) return "Sin electricidad";
      if (ratio < 1) return "Red sobrecargada";
      if (m.type === "assembler") return "Fabricando";
      if (m.type === "lab") return "Investigando";
      if (m.type === "launchpad") return m.progress >= 6 - 1e-8 ? "Listo para lanzar" : "Ensamblando cohete";
    }
    if (m.type === "generator") return m.fuel <= 1e-8 && m.stock.coal === 0 ? "Sin carb\xF3n" : (power ?? this.power()).generators.get(m) ? "Generando electricidad" : "En espera";
    if (m.type === "pole") return "Distribuye hasta 4 casillas";
    if (m.type === "miner") return "Extrayendo";
    if (m.type === "chest") return m.exporting ? "Exportando" : total(m.stock) >= 200 * this.batchSize() ? "Cofre lleno" : "Almacenando";
    if (m.type === "undergroundIn") {
      const end = this.undergroundExit(m);
      if (!end) return "Sin salida subterr\xE1nea alineada";
      if (total(end.stock) >= this.batchSize() && total(m.stock) > 0) return "Salida subterr\xE1nea ocupada";
      return total(m.stock) ? "Transportando bajo tierra" : "Entrada conectada \xB7 esperando material";
    }
    if (m.type === "undergroundOut" && !total(m.stock)) return "Salida subterr\xE1nea \xB7 esperando material";
    if ((m.type === "belt" || m.type === "splitter") && !total(m.stock)) return "Esperando material";
    if (m.type === "furnace") {
      if (total(m.output) >= this.outputLimit(m)) return "Salida llena";
      if (m.stock.iron + m.stock.copper === 0) return "Sin mineral";
      if (m.fuel <= 1e-8 && m.stock.coal === 0) return "Sin carb\xF3n";
      return "Fundiendo";
    }
    const carried = ITEMS.find((i) => m.stock[i] > 0);
    const exits = m.type === "splitter" ? [m.dir, (m.dir + 1) % 4] : [m.dir];
    const neighbors = exits.map((dir2) => this.at(m.x + DIRECTIONS[dir2].x, m.y + DIRECTIONS[dir2].y)).filter((n) => !!n);
    const open2 = neighbors.some((next) => carried && this.accepts(next, carried) && !(["belt", "splitter"].includes(next.type) && next.x + DIRECTIONS[next.dir].x === m.x && next.y + DIRECTIONS[next.dir].y === m.y));
    return !neighbors.length ? "Sin conexi\xF3n de salida" : !open2 ? "Salida bloqueada" : m.type === "splitter" ? "Distribuyendo" : "Transportando";
  }
  // Avanza la simulación por intervalos de tiempo.
  tick(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    let remaining = dt;
    while (remaining > 1e-8) {
      const step2 = Math.min(0.05, remaining);
      this.step(step2);
      remaining -= step2;
    }
  }
  // Actualiza máquinas, transporte, producción e investigación.
  step(dt) {
    this.state.time += dt;
    for (const shipment of this.state.shipments.filter((s) => s.arrival <= this.state.time)) {
      const target2 = shipment.to === this.state.planet ? this.state.inventory : this.state.colonies[shipment.to]?.inventory;
      if (target2) {
        for (const i of ITEMS) target2[i] += shipment.cargo[i];
        this.state.deliveredCargo += total(shipment.cargo);
      }
    }
    this.state.shipments = this.state.shipments.filter((s) => s.arrival > this.state.time);
    if (this.state.flight) {
      const f = this.state.flight;
      f.elapsed += dt;
      if (f.elapsed >= 8 - 1e-8) {
        this.state.flight = null;
        this.archive();
        this.state.launches++;
        this.state.credits += 10 + this.state.highestPlanet * 5;
        this.state.highestPlanet = f.to;
        this.activate(f.to, f.cargo);
      }
      return;
    }
    const power = this.power();
    const batch = this.batchSize(), boost = this.productivity();
    for (const m of this.state.machines) {
      if (m.type === "generator") {
        if (power.generators.get(m)) {
          if (m.fuel <= 1e-8) {
            m.stock.coal--;
            m.fuel = 20;
          }
          m.fuel = Math.max(0, m.fuel - dt);
          if (m.fuel < 1e-8) m.fuel = 0;
        }
      } else if (m.type === "miner") {
        if (total(m.output) >= this.outputLimit(m) || this.tile(m.x, m.y).amount <= 0) {
          m.progress = 0;
          continue;
        }
        m.progress += dt * (power.ratios.get(m) ?? 0) * boost;
        if (m.progress >= 1 - 1e-8) {
          const tile2 = this.tile(m.x, m.y);
          if (tile2.resource && tile2.amount > 0) {
            const n = Math.min(batch, tile2.amount, this.outputLimit(m) - total(m.output)), key = `${m.x},${m.y}`;
            this.state.depleted[key] = (this.state.depleted[key] ?? 0) + n;
            m.output[tile2.resource] += n;
            this.state.production[tile2.resource] += n;
            this.state.mined += n;
            m.produced += n;
          }
          m.progress = 0;
        }
      } else if (m.type === "furnace") {
        const ore2 = m.stock.iron > 0 ? "iron" : m.stock.copper > 0 ? "copper" : null;
        if (!ore2 || total(m.output) >= this.outputLimit(m)) continue;
        if (m.fuel <= 1e-8) {
          m.fuel = 0;
          if (!m.stock.coal) continue;
          m.stock.coal--;
          m.fuel = 8;
        }
        const work = Math.min(dt * (this.hasTech("smelting") ? 1.5 : 1) * boost, m.fuel, 2 - m.progress);
        m.fuel = Math.max(0, m.fuel - work);
        if (m.fuel < 1e-8) m.fuel = 0;
        m.progress += work;
        if (m.progress >= 2 - 1e-8) {
          const plate2 = ore2 === "iron" ? "ironPlate" : "copperPlate", n = Math.min(batch, m.stock[ore2], this.outputLimit(m) - total(m.output), 1 + Math.floor((m.fuel + m.stock.coal * 8 + 1e-8) / 2));
          let extra = 2 * (n - 1);
          while (extra > 1e-8) {
            if (m.fuel <= 1e-8) {
              m.stock.coal--;
              m.fuel = 8;
            }
            const used = Math.min(extra, m.fuel);
            m.fuel -= used;
            extra -= used;
          }
          m.stock[ore2] -= n;
          m.output[plate2] += n;
          this.state.production[plate2] += n;
          m.produced += n;
          this.state.smelted += n;
          m.progress = 0;
        }
      } else if (m.type === "assembler") {
        if (!this.canWork(m) || m.recipe === "none") continue;
        const recipe = RECIPES[m.recipe];
        m.progress += dt * (power.ratios.get(m) ?? 0) * (this.hasTech("industry") ? 1.5 : 1) * boost;
        if (m.progress >= recipe.seconds - 1e-8) {
          const runs = Math.min(batch, ...Object.entries(recipe.input).map(([i, n]) => Math.floor(m.stock[i] / n)), Math.floor((this.outputLimit(m) - total(m.output)) / Object.values(recipe.output).reduce((a, b) => a + b, 0)));
          for (const [i, n] of Object.entries(recipe.input)) m.stock[i] -= n * runs;
          for (const [i, n] of Object.entries(recipe.output)) {
            m.output[i] += n * runs;
            this.state.production[i] += n * runs;
          }
          m.produced += runs;
          m.progress = 0;
        }
      } else if (m.type === "lab") {
        const research = this.state.research;
        if (!research || !m.stock.science) continue;
        m.progress += dt * (power.ratios.get(m) ?? 0);
        if (m.progress >= 2 - 1e-8) {
          const n = Math.min(batch, m.stock.science, TECHS[research].cost - this.state.techProgress[research]);
          m.stock.science -= n;
          this.state.techProgress[research] += n;
          m.produced += n;
          m.progress = 0;
          if (this.state.techProgress[research] >= TECHS[research].cost) {
            this.state.unlocked.push(research);
            this.state.research = null;
          }
        }
      } else if (m.type === "launchpad") {
        if (this.canWork(m)) {
          m.progress = Math.min(6, m.progress + dt * (power.ratios.get(m) ?? 0));
          if (m.progress > 6 - 1e-8) m.progress = 6;
        }
      } else if (m.type === "inserter") {
        if (this.canWork(m)) m.progress = Math.min(0.8, m.progress + dt * (power.ratios.get(m) ?? 0) * boost);
      } else if (["belt", "splitter", "undergroundIn", "undergroundOut"].includes(m.type)) m.progress = total(m.stock) > 0 ? Math.min(this.beltDuration(), m.progress + dt) : 0;
    }
    const locations = new Map(this.state.machines.flatMap((m) => Array.from({ length: machineSize(m) ** 2 }, (_, i) => [`${m.x + i % machineSize(m)},${m.y + Math.floor(i / machineSize(m))}`, m])));
    const moves = [];
    const reservations = /* @__PURE__ */ new Map();
    const outgoing = /* @__PURE__ */ new Map();
    for (const m of this.state.machines) {
      if (m.type === "inserter") {
        if (m.progress < 0.8 - 1e-8 || !(power.ratios.get(m) ?? 0)) continue;
        const { from, to } = this.inserterEnds(m);
        if (!from || !to || from === to || from.type === "inserter" || to.type === "inserter" || to.type === "undergroundOut") continue;
        if (to.type === "undergroundIn" && (m.x !== to.x - DIRECTIONS[to.dir].x || m.y !== to.y - DIRECTIONS[to.dir].y)) continue;
        if (["belt", "splitter"].includes(to.type) && to.x + DIRECTIONS[to.dir].x === m.x && to.y + DIRECTIONS[to.dir].y === m.y) continue;
        const reserved = reservations.get(to) ?? inventory(), sent2 = outgoing.get(from) ?? inventory(), source2 = this.transferStock(from);
        const item2 = ITEMS.find((i) => {
          const used2 = ["belt", "splitter", "chest", "undergroundIn", "undergroundOut"].includes(to.type) ? total(to.stock) + total(reserved) : to.stock[i] + reserved[i];
          return source2[i] > sent2[i] && this.inputLimit(to, i) > used2;
        });
        if (!item2) continue;
        const used = ["belt", "splitter", "chest", "undergroundIn", "undergroundOut"].includes(to.type) ? total(to.stock) + total(reserved) : to.stock[item2] + reserved[item2];
        const amount = Math.min(batch, source2[item2] - sent2[item2], this.inputLimit(to, item2) - used);
        reserved[item2] += amount;
        sent2[item2] += amount;
        reservations.set(to, reserved);
        outgoing.set(from, sent2);
        moves.push({ from, to, item: item2, amount, via: m });
        continue;
      }
      if (["pole", "generator", "lab", "launchpad"].includes(m.type) || m.type === "chest" && !m.exporting || ["belt", "splitter", "undergroundIn", "undergroundOut"].includes(m.type) && m.progress < this.beltDuration() - 1e-8) continue;
      const source = this.transferStock(m), sent = outgoing.get(m) ?? inventory();
      const item = ITEMS.find((i) => source[i] > sent[i]);
      if (!item) continue;
      if (m.type === "undergroundIn") {
        const to = this.undergroundExit(m);
        if (!to) continue;
        const reserved = reservations.get(to) ?? inventory(), used = total(to.stock) + total(reserved), cap = this.inputLimit(to, item);
        if (used >= cap) continue;
        const amount = Math.min(batch, source[item] - sent[item], cap - used);
        reserved[item] += amount;
        sent[item] += amount;
        reservations.set(to, reserved);
        outgoing.set(m, sent);
        moves.push({ from: m, to, item, amount });
        continue;
      }
      const exits = m.type === "splitter" ? [(m.dir + m.branch) % 4, (m.dir + 1 - m.branch) % 4] : [m.dir];
      for (const dir2 of exits) {
        const d = DIRECTIONS[dir2], to = locations.get(`${m.x + d.x},${m.y + d.y}`);
        if (!to || to.type === "undergroundOut") continue;
        if (to.type === "undergroundIn" && (m.x !== to.x - DIRECTIONS[to.dir].x || m.y !== to.y - DIRECTIONS[to.dir].y)) continue;
        if (["belt", "splitter", "undergroundIn"].includes(to.type) && to.x + DIRECTIONS[to.dir].x === m.x && to.y + DIRECTIONS[to.dir].y === m.y) continue;
        const reserved = reservations.get(to) ?? inventory(), cap = this.inputLimit(to, item);
        const used = ["belt", "splitter", "chest", "undergroundIn", "undergroundOut"].includes(to.type) ? total(to.stock) + total(reserved) : to.stock[item] + reserved[item];
        if (cap <= 0 || used >= cap) continue;
        const amount = Math.min(batch, source[item] - sent[item], cap - used);
        reserved[item] += amount;
        sent[item] += amount;
        outgoing.set(m, sent);
        reservations.set(to, reserved);
        moves.push({ from: m, to, item, amount });
        break;
      }
    }
    for (const { from, to, item, amount, via } of moves) {
      (["belt", "splitter", "chest", "undergroundIn", "undergroundOut"].includes(from.type) ? from.stock : from.output)[item] -= amount;
      to.stock[item] += amount;
      if (via) {
        via.progress = 0;
        via.produced += amount;
      }
      if (["belt", "splitter", "undergroundIn", "undergroundOut"].includes(from.type)) from.progress = 0;
      if (from.type === "splitter") from.branch = from.branch === 0 ? 1 : 0;
      if (["belt", "splitter", "undergroundIn", "undergroundOut"].includes(to.type)) {
        const origin = via ?? from;
        to.progress = 0;
        const side = DIRECTIONS.findIndex((d) => to.x + d.x === origin.x && to.y + d.y === origin.y);
        to.entry = side < 0 ? (to.dir + 2) % 4 : side;
      }
      if (to.type === "chest" && (item === "ironPlate" || item === "copperPlate")) this.state.delivered += amount;
    }
  }
};
function demoState() {
  const s = createState("aurora-01");
  s.player = { x: 50.5, y: 50.5 };
  s.kitClaimed = true;
  s.machines = [machine("miner", 51, 48), machine("belt", 52, 48), machine("furnace", 53, 48), machine("belt", 54, 48), machine("chest", 55, 48), machine("miner", 51, 43), machine("belt", 52, 43), machine("belt", 53, 43, 1), ...Array.from({ length: 4 }, (_, i) => machine("belt", 53, 44 + i, 1))];
  const g = machine("generator", 49, 46);
  g.stock.coal = 10;
  s.machines.push(g);
  return s;
}
function industrialDemoState() {
  const s = demoState();
  s.industrialKit = true;
  s.player = { x: 49.5, y: 50.5 };
  s.research = "electronics";
  const feedCoal = machine("chest", 48, 46);
  feedCoal.stock.coal = 200;
  feedCoal.exporting = true;
  const feedIron = machine("chest", 45, 53);
  feedIron.stock.ironPlate = 160;
  feedIron.exporting = true;
  const gears = machine("assembler", 46, 53);
  const science = machine("assembler", 48, 53);
  science.recipe = "science";
  const feedCopper = machine("chest", 46, 56);
  feedCopper.stock.copperPlate = 80;
  feedCopper.exporting = true;
  const wires = machine("assembler", 47, 56);
  wires.recipe = "wire";
  const circuits = machine("assembler", 53, 53);
  circuits.recipe = "circuit";
  circuits.stock.ironPlate = 6;
  circuits.stock.wire = 12;
  s.machines.push(feedCoal, machine("pole", 49, 51), machine("pole", 46, 54), machine("pole", 52, 51), feedIron, gears, machine("belt", 47, 53), science, machine("belt", 49, 53), machine("lab", 50, 53), feedCopper, wires, machine("belt", 48, 56, 3), machine("belt", 48, 55, 3), machine("belt", 48, 54, 3), circuits, machine("chest", 54, 53));
  return s;
}
function spaceDemoState() {
  const s = createState("aurora-01");
  s.kitClaimed = s.industrialKit = true;
  s.player = { x: 48.5, y: 50.5 };
  for (const id of TECH_IDS.filter((t) => t !== "interstellar")) {
    s.unlocked.push(id);
    s.techProgress[id] = TECHS[id].cost;
  }
  Object.assign(s.inventory, { iron: 20, copper: 20, stone: 30, coal: 20, ironPlate: 12, copperPlate: 12 });
  const frame2 = machine("assembler", 48, 48);
  frame2.recipe = "rocketFrame";
  Object.assign(frame2.stock, { steel: 20, gear: 20 });
  const engine = machine("assembler", 53, 48, 2);
  engine.recipe = "rocketEngine";
  Object.assign(engine.stock, { steel: 20, gear: 20, circuit: 20 });
  const avionics = machine("assembler", 50, 46, 1);
  avionics.recipe = "advancedCircuit";
  Object.assign(avionics.stock, { circuit: 20, wire: 20 });
  const fuel = machine("assembler", 50, 51, 3);
  fuel.recipe = "rocketFuel";
  Object.assign(fuel.stock, { coal: 20, copperPlate: 20 });
  const steel = machine("assembler", 45, 48);
  steel.recipe = "steel";
  Object.assign(steel.stock, { ironPlate: 20, coal: 10 });
  const g = machine("generator", 47, 45);
  g.stock.coal = 10;
  const feeder = machine("chest", 46, 45);
  feeder.exporting = true;
  feeder.stock.coal = 200;
  s.machines = [frame2, engine, avionics, fuel, steel, g, feeder, machine("chest", 46, 48), machine("pole", 50, 45), machine("pole", 51, 50), machine("launchpad", 50, 48), machine("belt", 49, 48), machine("belt", 52, 48, 2), machine("belt", 50, 47, 1), machine("belt", 50, 50, 3)];
  return s;
}
function conveyorPoint(dir2, entry, t) {
  const start = DIRECTIONS[entry], end = DIRECTIONS[dir2], p = Math.max(0, Math.min(1, t));
  const sx = 16 + start.x * 16, sy = 16 + start.y * 16, ex = 16 + end.x * 16, ey = 16 + end.y * 16;
  return { x: (1 - p) * (1 - p) * sx + 2 * (1 - p) * p * 16 + p * p * ex, y: (1 - p) * (1 - p) * sy + 2 * (1 - p) * p * 16 + p * p * ey };
}


// === GRÁFICOS: dibujos e iconos de los objetos. ===
// Fuente: cambios/src/rendering/item-icons.ts
var ink = "#10192e";
var shape = (d, fill, stroke = ink) => ({ d, fill, stroke });
var rect = (x, y, w2, h2, fill) => shape(`M${x} ${y}h${w2}v${h2}h${-w2}Z`, fill);
var circle = (x, y, r, fill) => shape(`M${x - r} ${y}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`, fill);
var shine = (d) => shape(d, "none", "#ffffffa0");
function rock(base, light) {
  return [
    shape("M4 22L3 13 11 5 22 6 29 16 24 26 12 28Z", base),
    shape("M3 13L11 5 22 6 18 16 9 20Z", light),
    shape("M18 16L29 16 24 26 12 28 9 20Z", base),
    shine("M8 12L12 8 18 9")
  ];
}
function plate(base, light) {
  return [
    shape("M3 13L23 7 29 18 9 25Z", base),
    shape("M3 13L9 25V28L3 16Z", light),
    shape("M9 25L29 18V21L9 28Z", base),
    shine("M7 14L22 10"),
    shine("M12 23L25 19")
  ];
}
function board(base, core) {
  return [
    rect(5, 5, 22, 22, base),
    shape("M9 4V1M15 4V1M22 4V1M9 28V31M16 28V31M23 28V31M4 10H1M4 21H1M28 10H31M28 21H31", "none", "#ffd373"),
    shape("M8 10H12V16M24 22H20V17M22 9H18V12M8 24H13V20", "none", "#c1ffd9"),
    rect(11, 11, 10, 10, core),
    rect(14, 14, 4, 4, "#fff0a6"),
    circle(23, 24, 1, "#ffdf77")
  ];
}
var gearTeeth = Array.from({ length: 32 }, (_, i) => {
  const angle = i * Math.PI / 16 - Math.PI / 2, r = i % 4 === 0 || i % 4 === 3 ? 13 : 10;
  return `${i ? "L" : "M"}${(16 + Math.cos(angle) * r).toFixed(2)} ${(16 + Math.sin(angle) * r).toFixed(2)}`;
}).join(" ") + "Z";
var ITEM_SHAPES = {
  iron: rock("#43a7d8", "#9af3ff"),
  copper: rock("#d56c35", "#ffc075"),
  coal: [...rock("#45435e", "#8e7da8"), shape("M9 20L14 14 20 18 24 26M18 16L22 9", "none", "#201d36")],
  stone: [...rock("#b89c74", "#f7de9b"), shine("M15 23L20 21")],
  titanium: [shape("M4 22L7 8 18 3 28 12 25 26 13 29Z", "#8478d3"), shape("M7 8L18 3 20 17 13 29 4 22Z", "#d0c8ff"), shine("M11 10L16 7 17 15"), shape("M20 17L28 12 25 26 13 29Z", "#7166b5")],
  crystal: [shape("M4 20L7 10 13 13 18 2 25 8 28 23 17 30Z", "#b943d4"), shape("M18 2L15 22 17 30 25 8Z", "#fa9aff"), shape("M7 10L4 20 15 26 13 13Z", "#e977f1"), shine("M19 7L18 17")],
  ironPlate: plate("#69bcd9", "#c7f8ff"),
  copperPlate: plate("#d48343", "#ffe1a1"),
  gear: [shape(gearTeeth, "#a7bcd2"), circle(16, 16, 7, "#deeff9"), circle(16, 16, 3.5, ink), shine("M8 14L10 10 14 8")],
  wire: [rect(8, 6, 16, 20, "#ae6634"), shape("M8 9Q16 3 24 9V24Q16 30 8 24Z", "#f1a441"), shape("M8 11Q16 17 24 11M8 16Q16 22 24 16M8 21Q16 27 24 21", "none", "#8b472a"), shape("M10 7Q16 3 22 7M10 10Q16 14 22 10", "none", "#ffe1a1"), shape("M24 24H29V29", "none", "#ffc868")],
  circuit: board("#23936e", "#26364b"),
  science: [shape("M11 3H21V7H19V14L27 26Q28 29 24 29H8Q4 29 5 26L13 14V7H11Z", "#cadde8"), shape("M10 20H22L26 27H6Z", "#f45da9"), rect(11, 2, 10, 4, "#778aac"), shine("M14 9V15L9 24"), circle(18, 24, 1.3, "#ffbadb")],
  steel: [shape("M4 6H27V11H20V22H27V27H4V22H11V11H4Z", "#7c90af"), shape("M6 7H25V10H18V23H25V25H6V23H13V10H6Z", "#d1e2ef"), shine("M6 8H24")],
  advancedCircuit: board("#9a4eac", "#4a265a"),
  rocketFrame: [shape("M8 4H24L28 28H4Z", "#456c92"), shape("M11 7H21L24 25H8Z", "#15283e"), shape("M10 7L23 25M22 7L9 25M8 16H24", "none", "#b4e7fa"), rect(7, 3, 18, 4, "#d2f4ff"), rect(3, 25, 26, 4, "#89b6d4")],
  rocketEngine: [rect(11, 3, 10, 8, "#a9c4df"), rect(8, 9, 16, 7, "#e98857"), shape("M11 16H21L27 27H5Z", "#617892"), shape("M9 23H23L26 27H6Z", "#f1b184"), shape("M12 28L16 32 20 28Z", "#ffe189"), shine("M13 5H18"), rect(5, 13, 4, 7, "#aebad0"), rect(23, 13, 4, 7, "#aebad0")],
  rocketFuel: [rect(9, 2, 14, 5, "#aeb699"), shape("M8 6H24L26 11V28H6V11Z", "#bdcc72"), rect(8, 12, 16, 13, "#536852"), shape("M17 13L12 20H16L14 24 21 17H17Z", "#ffe197"), shine("M10 8H20")],
  alloy: [shape("M3 21L8 14H23L29 22 24 28H7Z", "#7168b2"), shape("M8 14H23L26 19H5Z", "#d6ccff"), shape("M9 5H23L27 12 22 18H7L4 12Z", "#a296df"), shape("M9 5H23L25 10H6Z", "#e9e4ff"), shine("M10 7H21")],
  navCore: [shape("M16 2L29 10V23L16 30 3 23V10Z", "#874c9e"), circle(16, 16, 10, "#34345a"), circle(16, 16, 7, "#df6fc6"), shape("M16 8L19 14 24 16 18 19 16 25 13 18 8 16 14 13Z", "#ffefb3"), circle(16, 16, 2, "#fff8e8"), shine("M9 11L12 8")]
};
function itemSVG(item) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><g stroke-linejoin="round" stroke-linecap="round" stroke-width="1.5">${ITEM_SHAPES[item].map((s) => `<path d="${s.d}" fill="${s.fill}" stroke="${s.stroke}"/>`).join("")}</g></svg>`;
}
var urls = new Map(ITEMS.map((item) => [item, `data:image/svg+xml,${encodeURIComponent(itemSVG(item))}`]));
function itemIcon(item) {
  return `<img class="item-icon" src="${urls.get(item)}" width="32" height="32" alt="" aria-hidden="true" draggable="false">`;
}
var paths = /* @__PURE__ */ new Map();
function drawItem(c, item, x, y, size = 4) {
  let drawings = paths.get(item);
  if (!drawings) {
    drawings = ITEM_SHAPES[item].map((s) => ({ path: new Path2D(s.d), shape: s }));
    paths.set(item, drawings);
  }
  c.save();
  c.translate(x - size, y - size);
  c.scale(size / 16, size / 16);
  c.lineWidth = 1.5;
  c.lineJoin = "round";
  c.lineCap = "round";
  for (const { path, shape: s } of drawings) {
    if (s.fill !== "none") {
      c.fillStyle = s.fill;
      c.fill(path);
    }
    if (s.stroke && s.stroke !== "none") {
      c.strokeStyle = s.stroke;
      c.stroke(path);
    }
  }
  c.restore();
}


// === DIAGNÓSTICO: identificar bloqueos y problemas de máquinas. ===
// Fuente: cambios/src/simulation/diagnostics.ts
function machineDiagnostics(w2, m, power = w2.power()) {
  const result = [];
  const add = (kind, warning, message) => result.push({ kind, warning: warning && (kind === "Energ\xEDa" || m.type === "miner" && kind === "Entrada"), message });
  if (m.type === "inserter") {
    const { from, to } = w2.inserterEnds(m);
    add("Entrada", !from || !ITEMS.some((i) => w2.transferStock(from)[i] > 0), !from ? "Coloc\xE1 un cofre, cinta o m\xE1quina detr\xE1s del brazo." : `${MACHINE_NAMES[from.type]} detr\xE1s: ${ITEMS.some((i) => w2.transferStock(from)[i] > 0) ? "material disponible para retirar." : "sin material disponible; de las f\xE1bricas toma la salida."}`);
    add("Salida", !to || !!from && !w2.inserterItem(m) && ITEMS.some((i) => w2.transferStock(from)[i] > 0), !to ? "Coloc\xE1 la m\xE1quina de destino delante de la flecha." : w2.inserterItem(m) ? `${MACHINE_NAMES[to.type]} acepta ${ITEM_NAMES[w2.inserterItem(m)]}.` : `${MACHINE_NAMES[to.type]}: entrada llena, material incompatible o cinta orientada hacia el brazo. Gir\xE1 con R si corresponde.`);
  } else if (m.type === "miner") {
    const tile2 = w2.tile(m.x, m.y);
    add("Entrada", tile2.amount <= 0, tile2.amount <= 0 ? "Yacimiento agotado: traslad\xE1 la minera a otra casilla." : `${tile2.resource ? ITEM_NAMES[tile2.resource] : "Mineral"}: ${tile2.amount} unidades en esta casilla.`);
  } else if (m.type === "generator" || m.type === "furnace") {
    if (m.type === "furnace") add("Entrada", m.stock.iron + m.stock.copper === 0, m.stock.iron + m.stock.copper === 0 ? "Falta mena de hierro o cobre." : "Hay mineral para fundir.");
    add("Energ\xEDa", m.stock.coal === 0 && m.fuel <= 1e-8, m.stock.coal === 0 && m.fuel <= 1e-8 ? "Falta carb\xF3n. Cargalo a mano, por cinta o con un brazo." : `${m.stock.coal} carb\xF3n almacenado \xB7 combustible encendido ${m.fuel.toFixed(1)} s.`);
  } else if (m.type === "assembler") {
    if (m.recipe === "none") {
      add("Configuraci\xF3n", false, "Eleg\xED una receta para comenzar la producci\xF3n.");
      return result;
    }
    const missing = Object.entries(RECIPES[m.recipe].input).filter(([i, n]) => m.stock[i] < n);
    add("Entrada", missing.length > 0, missing.length ? "Faltan " + missing.map(([i, n]) => `${ITEM_NAMES[i]} ${m.stock[i]}/${n}`).join(" \xB7 ") + "." : "Ingredientes disponibles para la receta.");
    if (!w2.recipeUnlocked(m.recipe)) add("Configuraci\xF3n", true, "La receta requiere una tecnolog\xEDa pendiente.");
  } else if (m.type === "lab") {
    add("Entrada", m.stock.science === 0, m.stock.science === 0 ? "Faltan paquetes cient\xEDficos. Cargalos desde un cofre, cinta o mochila." : `${m.stock.science} paquetes cient\xEDficos disponibles.`);
    if (!w2.state.research) add("Configuraci\xF3n", true, "Eleg\xED una tecnolog\xEDa en T para investigar.");
  } else if (m.type === "chest") {
    add("Entrada", total(m.stock) >= 200 * w2.batchSize(), `${total(m.stock)} / ${200 * w2.batchSize()} unidades${total(m.stock) >= 200 * w2.batchSize() ? " \xB7 cofre lleno; vacialo o retirale materiales con un brazo." : "."}`);
    if (!m.exporting) add("Salida", false, "Almacenamiento: exportaci\xF3n autom\xE1tica desactivada. Un brazo puede retirar materiales sin activarla.");
  } else if (m.type === "launchpad") {
    const missing = Object.entries(w2.requirements()).filter(([i, n]) => m.stock[i] < n);
    add("Entrada", missing.length > 0, missing.length ? "Faltan componentes: " + missing.map(([i, n]) => `${ITEM_NAMES[i]} ${m.stock[i]}/${n}`).join(" \xB7 ") : "Componentes completos.");
  } else if (["belt", "splitter"].includes(m.type) && !total(m.stock)) add("Entrada", false, "Esperando materiales de la m\xE1quina o cinta anterior.");
  if (DEMAND[m.type]) {
    const ratio = power.ratios.get(m) ?? 0;
    add("Energ\xEDa", ratio < 1, ratio === 0 ? "Sin electricidad: acerc\xE1 un generador con carb\xF3n o un poste conectado (cobertura de 4 casillas)." : ratio < 1 ? "Red sobrecargada: agreg\xE1 generaci\xF3n o reduc\xED la demanda." : `Electricidad disponible \xB7 ${DEMAND[m.type]} kW base.`);
  } else if (["chest", "belt", "splitter"].includes(m.type)) add("Energ\xEDa", false, "Este objeto no necesita electricidad.");
  if (!["inserter", "generator", "pole", "lab", "launchpad"].includes(m.type) && (m.type !== "chest" || m.exporting)) {
    const source = w2.transferStock(m), item = ITEMS.find((i) => source[i] > 0);
    if (item) {
      const exits = m.type === "splitter" ? [m.dir, (m.dir + 1) % 4] : [m.dir];
      const neighbors = exits.map((dir2) => {
        const d = DIRECTIONS[dir2];
        return w2.at(m.x + d.x, m.y + d.y);
      }).filter((n) => !!n);
      const open2 = neighbors.some((to) => to.type === "inserter" ? w2.inserterEnds(to).from === m && w2.inserterItem(to) === item : w2.accepts(to, item) && !(["belt", "splitter"].includes(to.type) && to.x + DIRECTIONS[to.dir].x === m.x && to.y + DIRECTIONS[to.dir].y === m.y));
      add("Salida", !open2, !neighbors.length ? "No hay conexi\xF3n en la direcci\xF3n de la flecha. Conect\xE1 una cinta, cofre o un brazo que retire la salida." : !open2 ? "Destino lleno, material incompatible o cinta enfrentada. Revis\xE1 la orientaci\xF3n y el espacio disponible." : "Destino conectado y con espacio.");
    }
  }
  return result;
}


// === PERSONAJE: desplazamiento y colisiones. ===
// Fuente: cambios/src/gameplay/player.ts
function movePlayer(world2, dx, dy, dt) {
  const length = Math.hypot(dx, dy);
  if (!length) return;
  const p = world2.state.player;
  dx = dx / length * 3.5 * dt;
  dy = dy / length * 3.5 * dt;
  const blocked = (x, y) => x < 0.28 || y < 0.28 || x > SIZE - 0.28 || y > SIZE - 0.28 || world2.wreckBlocksPlayer(x, y) || world2.state.machines.some((m) => !["belt", "splitter", "pole", "undergroundIn", "undergroundOut"].includes(m.type) && overlapsPlayer(m, x, y));
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 0.15));
  for (let i = 0; i < steps; i++) {
    if (!blocked(p.x + dx / steps, p.y)) p.x += dx / steps;
    if (!blocked(p.x, p.y + dy / steps)) p.y += dy / steps;
  }
}


// === ALMACENAMIENTO: lectura y escritura de partidas en el navegador. ===
// Fuente: cambios/src/persistence/storage.ts
var KEY = "rocket-mining-v02-rebuilt";
function open() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(KEY, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("saves");
    r.onerror = () => reject(r.error);
    r.onsuccess = () => resolve(r.result);
  });
}
async function load() {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const r = db.transaction("saves").objectStore("saves").get("main");
      r.onsuccess = () => resolve(migrateState(r.result));
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}
async function save(state) {
  const snapshot = structuredClone(state);
  const db = await open();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction("saves", "readwrite");
      tx.objectStore("saves").put(snapshot, "main");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}


// === DIBUJO: mapa, terreno, máquinas, personaje y efectos. ===
// Fuente: cambios/src/rendering/render.ts
var INK = "#101326";
var cachedWorld = null;
var cachedPlanet = "";
var groundChunks = /* @__PURE__ */ new Map();
var exhausted = /* @__PURE__ */ new Set();
function polygon(c, points, fill, stroke = INK, width2 = 1.5) {
  c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = width2;
    c.stroke();
  }
}
function box(c, x, y, w2, h2, color, line = 1.6) {
  c.fillStyle = color;
  c.fillRect(x, y, w2, h2);
  if (line) {
    c.strokeStyle = INK;
    c.lineWidth = line;
    c.strokeRect(x, y, w2, h2);
  }
}
function arrow(c, x, y, dir2, color, size = 4) {
  c.save();
  c.translate(x, y);
  c.rotate(dir2 * Math.PI / 2);
  polygon(c, [[-size, -size * 0.7], [size, 0], [-size, size * 0.7], [-size * 0.4, 0]], color, INK, 0.8);
  c.restore();
}
function ore(c, x, y, size, r, n) {
  c.save();
  c.translate(x, y);
  c.rotate((n - 0.5) * 0.6);
  polygon(c, [[-size * 0.6, size * 0.35], [-size * 0.65, -size * 0.2], [-size * 0.15, -size * 0.7], [size * 0.45, -size * 0.5], [size * 0.7, size * 0.15], [size * 0.3, size * 0.55]], ITEM_COLORS[r], INK, 1.25);
  polygon(c, [[-size * 0.55, -size * 0.15], [-size * 0.15, -size * 0.55], [size * 0.4, -size * 0.4], [size * 0.1, -size * 0.05]], r === "coal" ? "#c7aaf8" : "#ffffff8c", "", 0);
  c.strokeStyle = r === "coal" ? "#4a336b" : "#182b3b90";
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(-size * 0.2, size * 0.1);
  c.lineTo(size * 0.1, -size * 0.05);
  c.lineTo(size * 0.4, size * 0.3);
  c.stroke();
  c.restore();
}
function terrain(c, world2, x, y) {
  const n = hash(x, y, world2.seed), gx = Math.floor(x / 10), gy = Math.floor(y / 10);
  const smooth = (t) => t * t * (3 - 2 * t), fx = smooth(x / 10 - gx), fy = smooth(y / 10 - gy);
  const mix = (a, b, t) => a + (b - a) * t;
  const region = mix(mix(hash(gx, gy, world2.seed + 43), hash(gx + 1, gy, world2.seed + 43), fx), mix(hash(gx, gy + 1, world2.seed + 43), hash(gx + 1, gy + 1, world2.seed + 43), fx), fy);
  const tint = Math.max(0, Math.min(1, (region - 0.25) * 2));
  const variation = (n - 0.5) * 9;
  const biome = world2.planet().biome, bases = biome === "ice" ? [[76, 121, 153], [147, 155, 195]] : biome === "volcanic" ? [[110, 60, 74], [143, 75, 96]] : [[40, 113, 113], [108, 76, 149]];
  c.fillStyle = `rgb(${Math.round(mix(bases[0][0], bases[1][0], tint) + variation)},${Math.round(mix(bases[0][1], bases[1][1], tint) + variation)},${Math.round(mix(bases[0][2], bases[1][2], tint) + variation)})`;
  c.fillRect(0, 0, 32.15, 32.15);
  c.strokeStyle = "#0b20301e";
  c.lineWidth = 0.6;
  c.strokeRect(0, 0, 32, 32);
  for (let i = 0; i < 5; i++) {
    const a = hash(x * 9 + i, y, world2.seed), b = hash(x, y * 9 + i, world2.seed);
    c.fillStyle = i % 2 ? "#bfe0b61b" : "#081c3430";
    c.fillRect(2 + a * 27, 2 + b * 27, 1 + a * 2.5, 0.8 + b);
  }
  if (n > 0.86) {
    c.strokeStyle = "#14283e66";
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(4, 21);
    c.lineTo(9, 18);
    c.lineTo(14, 20);
    c.lineTo(19, 17);
    c.stroke();
  }
  const tile2 = world2.tile(x, y);
  if (tile2.resource && tile2.amount > 0) {
    c.fillStyle = ITEM_COLORS[tile2.resource] + "25";
    c.fillRect(1, 1, 30, 30);
    for (let i = 0; i < 5; i++) {
      const a = hash(x * 7 + i, y * 3, world2.seed), b = hash(x * 3, y * 7 + i, world2.seed);
      ore(c, 5 + a * 22, 6 + b * 20, 3 + a * 2.3, tile2.resource, a);
    }
  } else if (n > 0.92) {
    c.strokeStyle = region > 0.68 ? "#d7a7d9" : "#56ae9f";
    c.lineWidth = 1.3;
    c.beginPath();
    c.moveTo(22, 24);
    c.lineTo(21, 18);
    c.moveTo(21, 21);
    c.lineTo(18, 19);
    c.moveTo(21, 22);
    c.lineTo(24, 19);
    c.stroke();
    c.fillStyle = region > 0.68 ? "#f3b1d3" : "#81e1ad";
    c.fillRect(20, 16, 2, 2);
  }
}
function machineSprite(c, m, world2, ghost = false, power) {
  const time = world2.state.time, active = world2.status(m, power);
  const work = ["Extrayendo", "Fundiendo", "Fabricando", "Investigando", "Red sobrecargada", "Ensamblando cohete"].includes(active);
  if (m.type === "inserter") {
    box(c, 7, 7, 18, 18, "#54738b", 2);
    box(c, 10, 10, 12, 12, "#25384e", 1.4);
    c.save();
    c.translate(16, 16);
    c.rotate(m.dir * Math.PI / 2);
    const phase = m.progress / 0.8, reach = active === "Transfiriendo materiales" ? Math.cos(phase * Math.PI) * 11 : 8;
    c.strokeStyle = INK;
    c.lineWidth = 7;
    c.beginPath();
    c.moveTo(-9, 4);
    c.lineTo(0, -5);
    c.lineTo(reach, 0);
    c.stroke();
    c.strokeStyle = "#ffc866";
    c.lineWidth = 4;
    c.stroke();
    box(c, -3, -8, 6, 6, "#ff925e", 1.2);
    box(c, reach - 2, -3, 4, 6, "#89f5e2", 1);
    c.strokeStyle = "#b5eaf0";
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(reach, -3);
    c.lineTo(reach + 4, -5);
    c.moveTo(reach, 3);
    c.lineTo(reach + 4, 5);
    c.stroke();
    c.restore();
    arrow(c, 16 + DIRECTIONS[m.dir].x * 14, 16 + DIRECTIONS[m.dir].y * 14, m.dir, "#a4ffe4", 3);
    return;
  }
  if (["belt", "splitter", "undergroundIn", "undergroundOut"].includes(m.type)) {
    const carried = ITEMS.find((i) => m.stock[i] > 0), connected = world2.beltInputs(m);
    const inputs = m.type === "undergroundIn" || m.type === "undergroundOut" ? [(m.dir + 2) % 4] : connected.length ? connected : [(m.dir + 2) % 4];
    const exits = m.type === "splitter" ? [m.dir, (m.dir + 1) % 4] : [m.dir];
    const paths2 = inputs.flatMap((entry) => exits.map((dir2) => ({ entry, dir: dir2 })));
    c.save();
    c.beginPath();
    c.rect(0, 0, 32, 32);
    c.clip();
    if (m.type === "undergroundIn" || m.type === "undergroundOut") {
      c.translate(16, 16);
      c.rotate(m.dir * Math.PI / 2);
      c.beginPath();
      c.rect(m.type === "undergroundIn" ? -16 : 0, -16, 16, 32);
      c.clip();
      c.rotate(-m.dir * Math.PI / 2);
      c.translate(-16, -16);
    }
    const path = (entry, dir2) => {
      const a = conveyorPoint(dir2, entry, 0), b = conveyorPoint(dir2, entry, 1);
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.quadraticCurveTo(16, 16, b.x, b.y);
    };
    c.lineCap = "butt";
    c.lineJoin = "round";
    for (const [width2, color] of [[26, INK], [22, "#f0bb50"], [16, "#253149"]]) {
      c.lineWidth = width2;
      c.strokeStyle = color;
      for (const p of paths2) {
        path(p.entry, p.dir);
        c.stroke();
      }
    }
    for (const p of paths2) for (let i = 0; i < 4; i++) {
      const t = (i / 4 + time / (world2.beltDuration() * 4)) % 1, point = conveyorPoint(p.dir, p.entry, t), next = conveyorPoint(p.dir, p.entry, Math.min(1, t + 0.01));
      c.save();
      c.translate(point.x, point.y);
      c.rotate(Math.atan2(next.y - point.y, next.x - point.x));
      c.strokeStyle = "#7e8ea8";
      c.lineWidth = 1.3;
      c.beginPath();
      c.moveTo(-2, -3);
      c.lineTo(1, 0);
      c.lineTo(-2, 3);
      c.stroke();
      c.restore();
    }
    c.restore();
    if (carried) {
      const t = m.progress / world2.beltDuration(), visible = m.type === "undergroundIn" ? t * 0.5 : m.type === "undergroundOut" ? 0.5 + t * 0.5 : t;
      const point = conveyorPoint(m.dir, m.entry, visible);
      drawItem(c, carried, point.x, point.y, 4.5);
      if (total(m.stock) > 1) {
        c.font = "bold 6px monospace";
        c.textAlign = "center";
        c.strokeStyle = INK;
        c.lineWidth = 2;
        c.strokeText(String(total(m.stock)), point.x, point.y + 8);
        c.fillStyle = "#fff6bf";
        c.fillText(String(total(m.stock)), point.x, point.y + 8);
      }
    }
    if (m.type === "splitter") {
      box(c, 12, 12, 8, 8, "#54ddba", 1.4);
      arrow(c, 16, 16, m.dir, "#fff3a1", 2.5);
    }
    if (m.type === "undergroundIn" || m.type === "undergroundOut") {
      c.save();
      c.translate(16, 16);
      c.rotate(m.dir * Math.PI / 2);
      box(c, -5, -12, 10, 24, "#4d6778", 2);
      box(c, -3, -8, 6, 16, "#151d2c", 1);
      arrow(c, 0, 0, 0, m.type === "undergroundIn" ? "#ffd06c" : "#8ff5d3", 3);
      c.fillStyle = m.type === "undergroundIn" ? "#ffd06c" : "#8ff5d3";
      c.font = "bold 6px sans-serif";
      c.textAlign = "center";
      c.fillText(m.type === "undergroundIn" ? "ENT" : "SAL", 0, -12);
      c.restore();
    }
    return;
  }
  if (m.type === "pole") {
    box(c, 14, 9, 4, 22, "#b28876", 1.2);
    box(c, 6, 5, 20, 4, "#718db1", 1.3);
    for (const x of [7, 15, 23]) box(c, x, 2, 3, 7, "#74e9ec", 1);
    c.fillStyle = "#09172966";
    c.fillRect(12, 30, 10, 2);
    return;
  }
  c.fillStyle = "#070f2566";
  c.beginPath();
  c.ellipse(18, 28, 15, 5, 0, 0, Math.PI * 2);
  c.fill();
  if (m.type === "miner") {
    box(c, 2, 5, 28, 24, "#38556c", 2.2);
    box(c, 5, 4, 22, 19, "#20bbae", 2);
    box(c, 5, 4, 22, 4, "#6bf4d5", 1.2);
    box(c, 1, 8, 5, 18, "#e1ad3e", 1.7);
    box(c, 26, 8, 5, 18, "#e1ad3e", 1.7);
    for (let y = 10; y < 25; y += 5) {
      c.fillStyle = INK;
      c.fillRect(1, y, 5, 2);
      c.fillRect(26, y, 5, 2);
    }
    box(c, 10, 10, 12, 10, "#243b59", 1.6);
    c.save();
    c.translate(16, 17);
    c.rotate(work ? time * 5 : 0);
    polygon(c, [[-8, -2], [6, -2], [8, 0], [6, 2], [-8, 2]], "#e1eeef", INK, 1.3);
    c.restore();
    box(c, 8, 24, 16, 5, "#22304b", 1.3);
    c.fillStyle = work ? "#9cff9c" : "#ff7c85";
    c.fillRect(9, 25, 3, 2);
    c.fillStyle = "#a8fff1";
    c.fillRect(8, 6, 3, 1);
  } else if (m.type === "furnace") {
    box(c, 3, 10, 26, 19, "#c34c54", 2.3);
    polygon(c, [[3, 10], [8, 4], [24, 4], [29, 10]], "#ff9259", INK, 2);
    box(c, 21, -1, 6, 10, "#687092", 1.7);
    box(c, 20, -2, 8, 3, "#a5a7c2", 1.3);
    box(c, 7, 12, 18, 12, "#32253f", 1.8);
    if (work) {
      c.fillStyle = "#ff6d37";
      c.fillRect(9, 15, 14, 7);
      polygon(c, [[10, 22], [11, 16], [14, 18], [17, 13 + Math.sin(time * 10)], [20, 18], [22, 16], [22, 22]], "#ffe379", "", 0);
      c.save();
      c.globalAlpha = 0.3;
      c.fillStyle = "#ff9042";
      c.beginPath();
      c.arc(16, 18, 14, 0, Math.PI * 2);
      c.fill();
      c.restore();
      for (let i = 0; i < 3; i++) {
        const t = (time * 0.6 + i * 0.33) % 1;
        c.fillStyle = `rgba(207,173,236,${0.38 * (1 - t)})`;
        c.beginPath();
        c.arc(24 + Math.sin(t * 5) * 3, -5 - t * 13, 2 + t * 3, 0, Math.PI * 2);
        c.fill();
      }
    }
    for (let x = 10; x <= 22; x += 4) {
      c.strokeStyle = INK;
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(x, 13);
      c.lineTo(x, 24);
      c.stroke();
    }
    box(c, 5, 26, 22, 4, "#7673a0", 1.4);
    c.fillStyle = "#ffc17d";
    c.fillRect(8, 6, 12, 2);
  } else if (m.type === "generator") {
    box(c, 2, 9, 28, 21, "#d1a246", 2);
    box(c, 4, 7, 24, 10, "#ffe077", 1.7);
    box(c, 6, 17, 20, 10, "#36415a", 1.5);
    box(c, 22, 1, 6, 10, "#7b82a2", 1.5);
    box(c, 21, 0, 8, 3, "#b6bbd1", 1);
    polygon(c, [[14, 8], [11, 17], [16, 17], [13, 25], [23, 13], [17, 13], [19, 8]], "#fff8b6", INK, 1.1);
    if (active === "Generando electricidad") {
      c.fillStyle = "#89ffc7";
      c.fillRect(6, 21, 3, 3);
      for (let i = 0; i < 2; i++) {
        const t = (time * 0.5 + i * 0.5) % 1;
        c.fillStyle = `rgba(181,190,221,${0.4 * (1 - t)})`;
        c.beginPath();
        c.arc(26 + t * 5, -3 - t * 12, 2 + t * 2, 0, Math.PI * 2);
        c.fill();
      }
    }
  } else if (m.type === "assembler") {
    box(c, 2, 5, 28, 24, "#3e68a4", 2.1);
    box(c, 4, 5, 24, 5, "#87baff", 1.4);
    box(c, 6, 11, 20, 14, "#223652", 1.6);
    c.save();
    c.translate(16, 18);
    c.rotate(work ? time * 2 : 0);
    drawItem(c, "gear", 0, 0, 8);
    c.restore();
    if (m.recipe !== "none") {
      const output = Object.keys(RECIPES[m.recipe].output)[0];
      drawItem(c, output, 25, 8, 3.3);
    }
    box(c, 6, 26, 20, 3, "#8badd6", 1);
  } else if (m.type === "lab") {
    box(c, 2, 24, 28, 6, "#b062b1", 1.6);
    polygon(c, [[4, 24], [4, 11], [8, 4], [24, 4], [28, 11], [28, 24]], "#434569", INK, 1.8);
    polygon(c, [[7, 22], [7, 12], [10, 7], [22, 7], [25, 12], [25, 22]], "#82d7f085", INK, 1);
    drawItem(c, "science", 16, 17, 7);
    if (work) {
      c.fillStyle = "#ffd5f3";
      c.fillRect(10 + Math.sin(time * 4) * 3, 10, 2, 2);
      c.fillStyle = "#75ffbb";
      c.fillRect(5, 26, 4, 2);
    }
  } else if (m.type === "launchpad") {
    box(c, 1, 1, 62, 62, "#53617b", 2.5);
    box(c, 6, 7, 52, 50, "#252f46", 2);
    for (let x = 5; x < 59; x += 9) {
      polygon(c, [[x, 2], [x + 4, 2], [x + 9, 7], [x + 5, 7]], "#ffd66b", INK, 0.7);
      polygon(c, [[x, 57], [x + 4, 57], [x + 9, 62], [x + 5, 62]], "#ffd66b", INK, 0.7);
    }
    for (const x of [5, 59]) for (const y of [12, 24, 36, 48]) box(c, x - 2, y, 4, 5, "#86b3ce", 1);
    box(c, 14, 42, 36, 10, "#141d30", 1.5);
    box(c, 53, -36, 6, 87, "#788ca6", 1.5);
    for (let y = -32; y < 47; y += 10) {
      c.strokeStyle = INK;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(54, y);
      c.lineTo(58, y + 8);
      c.stroke();
    }
    box(c, 41, -30, 18, 5, "#a7c7d4", 1.5);
    box(c, 43, -5, 13, 4, "#b3c6db", 1);
    const flight = world2.state.flight, launched = flight && flight.x === m.x && flight.y === m.y;
    if (world2.rocketLoaded(m) || launched) {
      c.save();
      if (launched) c.translate(0, -flight.elapsed * flight.elapsed * 8);
      c.globalAlpha = launched ? 1 : 0.4 + m.progress / 6 * 0.6;
      polygon(c, [[21, 17], [10, 43], [21, 39], [43, 39], [54, 43], [43, 17]], "#f5784f", INK, 2);
      box(c, 21, -22, 22, 61, "#f4efdc", 2);
      box(c, 22, -20, 4, 57, "#fffbed", 0);
      box(c, 38, -20, 4, 57, "#b5c3cc", 0);
      polygon(c, [[21, -22], [32, -44], [43, -22]], "#ffab67", INK, 2);
      box(c, 26, -14, 12, 14, "#3acfe5", 1.8);
      box(c, 28, -12, 3, 8, "#b3f9ff", 0);
      box(c, 21, 9, 22, 8, "#e46c69", 1.2);
      box(c, 24, 28, 16, 8, "#99b5c4", 1);
      box(c, 24, 39, 16, 7, "#67788d", 1.5);
      box(c, 26, 18, 12, 3, "#d6c8aa", 0);
      if (launched) {
        polygon(c, [[24, 46], [26, 66], [32, 57 + Math.sin(time * 25) * 4], [39, 70], [41, 46]], "#ff793d", INK, 1.5);
        polygon(c, [[28, 46], [32, 63], [37, 46]], "#fff0a3", "", 0);
      }
      c.restore();
    }
    if (active === "Listo para lanzar") {
      c.fillStyle = "#97ffc5";
      c.beginPath();
      c.arc(8, 48, 2, 0, Math.PI * 2);
      c.fill();
    }
  } else {
    box(c, 3, 9, 26, 20, "#64499a", 2.2);
    polygon(c, [[3, 9], [7, 4], [26, 4], [29, 9]], "#a18ad8", INK, 2);
    box(c, 4, 10, 24, 6, "#7c64ba", 1.4);
    box(c, 6, 6, 4, 22, "#dba84d", 1.3);
    box(c, 22, 6, 4, 22, "#dba84d", 1.3);
    box(c, 13, 13, 6, 7, "#ffd976", 1.4);
    box(c, 15, 15, 2, 3, INK, 0);
    c.fillStyle = "#c2b6f0";
    c.fillRect(11, 7, 9, 1.5);
    const amount = total(m.stock);
    if (amount) {
      c.font = "bold 7px Consolas,monospace";
      c.textAlign = "center";
      c.strokeStyle = INK;
      c.lineWidth = 2.5;
      c.strokeText(String(amount), 16, 26);
      c.fillStyle = "#fff0bd";
      c.fillText(String(amount), 16, 26);
    }
  }
  if (!["chest", "generator", "lab", "launchpad"].includes(m.type)) {
    const d = DIRECTIONS[m.dir];
    arrow(c, 16 + d.x * 14, 16 + d.y * 14, m.dir, "#fff0a5", 3.1);
    const out = ITEMS.find((i) => m.output[i] > 0);
    if (out) drawItem(c, out, 16 + d.x * 10, 16 + d.y * 10, 2.8);
    if (m.progress > 0) {
      box(c, 5, 31, 22, 2, INK, 0);
      c.fillStyle = m.type === "furnace" ? "#ffad66" : "#75f5d9";
      c.fillRect(5, 31, 22 * m.progress / (m.type === "furnace" || m.type === "lab" ? 2 : m.type === "assembler" && m.recipe !== "none" ? RECIPES[m.recipe].seconds : 1), 2);
    }
  }
}
function astronaut(c, time, walking) {
  const bob = walking ? Math.sin(time * 18) * 0.6 : 0;
  c.fillStyle = "#0b132478";
  c.beginPath();
  c.ellipse(0, 10, 8, 3, 0, 0, Math.PI * 2);
  c.fill();
  c.save();
  c.translate(0, bob);
  box(c, -7, 0, 5, 8, "#14b9b5", 1.5);
  box(c, -5, 6, 4, 5 + (walking ? Math.sin(time * 18) * 1.5 : 0), "#ee9363", 1.5);
  box(c, 2, 6, 4, 5 - (walking ? Math.sin(time * 18) * 1.5 : 0), "#ee9363", 1.5);
  box(c, -6, -2, 12, 10, "#fff0cb", 1.8);
  box(c, -6, 2, 12, 3, "#ff8058", 0.8);
  polygon(c, [[-7, -3], [-7, -10], [-4, -13], [5, -13], [8, -10], [8, -3], [4, 0], [-3, 0]], "#ffe9c3", INK, 1.8);
  box(c, -4, -10, 10, 6, "#28c4ea", 1.3);
  c.fillStyle = "#a5ffff";
  c.fillRect(-2, -9, 5, 1.7);
  box(c, 6, 1, 3, 6, "#ffbb68", 1.2);
  c.restore();
}
var lastPowerWorld = null;
var lastPowerAt = 0;
var lastPower = null;
var lastPowerCount = -1;
var lastDepletionScan = 0;
function render(c, world2, v) {
  const { w: w2, h: h2, dpr: dpr2, zoom: zoom2, camera: camera2 } = v, unit = 32 * zoom2;
  c.setTransform(dpr2, 0, 0, dpr2, 0, 0);
  c.imageSmoothingEnabled = false;
  c.fillStyle = "#264958";
  c.fillRect(0, 0, w2, h2);
  const ox = w2 / 2 - camera2.x * unit, oy = h2 / 2 - camera2.y * unit;
  const x0 = Math.max(0, Math.floor(camera2.x - w2 / 2 / unit)), x1 = Math.min(SIZE, Math.ceil(camera2.x + w2 / 2 / unit)), y0 = Math.max(0, Math.floor(camera2.y - h2 / 2 / unit)), y1 = Math.min(SIZE, Math.ceil(camera2.y + h2 / 2 / unit));
  const planetKey = `${world2.state.planet}/${world2.state.seed}`;
  if (cachedWorld !== world2 || cachedPlanet !== planetKey) {
    cachedWorld = world2;
    cachedPlanet = planetKey;
    groundChunks.clear();
    exhausted.clear();
    lastDepletionScan = 0;
  }
  if (performance.now() - lastDepletionScan > 250) {
    lastDepletionScan = performance.now();
    for (const key of Object.keys(world2.state.depleted)) {
      if (exhausted.has(key)) continue;
      const [x, y] = key.split(",").map(Number);
      if (world2.tile(x, y).amount > 0) continue;
      const ground = groundChunks.get(`${Math.floor(x / CHUNK)},${Math.floor(y / CHUNK)}`);
      if (ground) {
        const gc = ground.getContext("2d");
        gc.save();
        gc.translate(x % CHUNK * 32, y % CHUNK * 32);
        terrain(gc, world2, x, y);
        gc.restore();
        exhausted.add(key);
      }
    }
  }
  for (let cy = Math.floor(y0 / CHUNK); cy < Math.ceil(y1 / CHUNK); cy++) for (let cx = Math.floor(x0 / CHUNK); cx < Math.ceil(x1 / CHUNK); cx++) {
    const key = `${cx},${cy}`;
    let ground = groundChunks.get(key);
    if (!ground) {
      ground = document.createElement("canvas");
      ground.width = ground.height = CHUNK * 32;
      const gc = ground.getContext("2d");
      for (let ly = 0; ly < CHUNK; ly++) for (let lx = 0; lx < CHUNK; lx++) {
        gc.save();
        gc.translate(lx * 32, ly * 32);
        terrain(gc, world2, cx * CHUNK + lx, cy * CHUNK + ly);
        gc.restore();
      }
      groundChunks.set(key, ground);
    }
    c.drawImage(ground, ox + cx * CHUNK * unit, oy + cy * CHUNK * unit, CHUNK * unit, CHUNK * unit);
  }
  const p = world2.state.player, px = ox + p.x * unit, py = oy + p.y * unit;
  const wreck = world2.wreck();
  if (wreck) {
    c.save();
    c.translate(ox + wreck.x * unit, oy + wreck.y * unit);
    c.scale(zoom2, zoom2);
    c.fillStyle = "#09112477";
    c.beginPath();
    c.ellipse(49, 48, 47, 15, 0, 0, Math.PI * 2);
    c.fill();
    polygon(c, [[5, 33], [18, 13], [51, 15], [65, 24], [84, 26], [95, 39], [80, 53], [23, 55], [3, 43]], "#9d7d78", INK, 2.5);
    polygon(c, [[19, 13], [42, 4], [48, 16]], "#cf765c", INK, 2);
    polygon(c, [[16, 43], [23, 61], [47, 54]], "#c58063", INK, 2);
    polygon(c, [[22, 18], [54, 19], [66, 28], [59, 43], [24, 45]], "#d2c9ae", INK, 2);
    box(c, 28, 21, 24, 15, "#304557", 2);
    box(c, 30, 23, 10, 7, "#6cbdc5", 1);
    polygon(c, [[45, 20], [40, 28], [47, 30], [42, 36]], "#101b2e", "", 0);
    box(c, 6, 28, 13, 15, "#4a4e65", 2);
    box(c, 2, 30, 6, 11, "#c7895f", 1.5);
    polygon(c, [[65, 27], [83, 29], [91, 38], [76, 43], [61, 40]], "#d0b788", INK, 1.7);
    polygon(c, [[66, 29], [73, 33], [68, 38], [79, 42], [62, 43]], "#242c42", INK, 1.2);
    for (const [x, y] of [[18, 47], [58, 48], [75, 21], [5, 52], [88, 50]]) box(c, x, y, 5, 3, "#af9e8a", 1);
    const remaining = (world2.state.kitClaimed ? 0 : 8 - wreck.starter) + (world2.state.industrialKit ? 0 : 12 - wreck.industrial);
    box(c, 22, 57, 53, 4, "#10192e", 1);
    c.fillStyle = "#ffc271";
    c.fillRect(23, 58, 51 * remaining / 20, 2);
    c.textAlign = "center";
    c.font = "bold 7px Segoe UI,sans-serif";
    c.lineWidth = 2.5;
    c.strokeStyle = INK;
    c.strokeText(world2.canSalvage() ? "MANTEN\xC9 E \xB7 DESARMAR NAVE" : "NAVE ACCIDENTADA", 48, -4);
    c.fillStyle = "#ffe0a0";
    c.fillText(world2.canSalvage() ? "MANTEN\xC9 E \xB7 DESARMAR NAVE" : "NAVE ACCIDENTADA", 48, -4);
    c.restore();
  }
  const now = performance.now();
  if (lastPowerWorld !== world2 || !lastPower || now - lastPowerAt > 150 || lastPowerCount !== world2.state.machines.length) {
    lastPower = world2.power();
    lastPowerWorld = world2;
    lastPowerAt = now;
    lastPowerCount = world2.state.machines.length;
  }
  const power = lastPower;
  if (v.showPower || v.building && ["pole", "generator"].includes(v.tool)) {
    for (const node of world2.state.machines.filter((m) => m.type === "pole" || m.type === "generator")) {
      c.fillStyle = "#74fff119";
      c.strokeStyle = "#8efdf570";
      c.lineWidth = 1;
      c.beginPath();
      c.arc(ox + (node.x + 0.5) * unit, oy + (node.y + 0.5) * unit, 4 * unit, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
    if (v.building && v.target && ["pole", "generator"].includes(v.tool)) {
      c.strokeStyle = "#ffdb82aa";
      c.setLineDash([5, 5]);
      c.beginPath();
      c.arc(ox + (v.target.x + 0.5) * unit, oy + (v.target.y + 0.5) * unit, 4 * unit, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
    }
  }
  for (const link of power.links) {
    const ax = ox + (link.from.x + 0.5) * unit, ay = oy + (link.from.y + 0.2) * unit, bx = ox + (link.to.x + 0.5) * unit, by = oy + (link.to.y + 0.2) * unit;
    c.beginPath();
    c.moveTo(ax, ay);
    c.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + unit * 0.6, bx, by);
    c.strokeStyle = "#101326b0";
    c.lineWidth = 3;
    c.stroke();
    c.strokeStyle = "#f3d38cb0";
    c.lineWidth = 1;
    c.stroke();
  }
  if (v.building) {
    c.strokeStyle = "#fff0aa70";
    c.lineWidth = 1.5;
    c.setLineDash([3, 7]);
    c.beginPath();
    c.arc(px, py, 4 * unit, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
  }
  for (const m of [...world2.state.machines].sort((a, b) => (a.type === "belt" ? 0 : 1) - (b.type === "belt" ? 0 : 1) || a.y - b.y)) {
    if (m.x < x0 - 1 || m.y < y0 - 1 || m.x > x1 || m.y > y1) continue;
    c.save();
    c.translate(ox + m.x * unit, oy + m.y * unit);
    c.scale(zoom2, zoom2);
    machineSprite(c, m, world2, false, power);
    if ((m.type === "miner" || DEMAND[m.type]) && machineDiagnostics(world2, m, power).some((issue) => issue.warning)) {
      box(c, 24, -4, 9, 9, "#fa6b89", 1.4);
      c.font = "bold 7px monospace";
      c.textAlign = "center";
      c.fillStyle = INK;
      c.fillText("!", 28.5, 3.2);
    }
    c.restore();
  }
  if (v.selected) {
    c.strokeStyle = "#ffda76";
    c.lineWidth = 2;
    c.strokeRect(ox + v.selected.x * unit - 2, oy + v.selected.y * unit - 2, unit * machineSize(v.selected) + 4, unit * machineSize(v.selected) + 4);
  }
  const salvage = world2.canSalvage() ? wreck : null, nearest = salvage ? { x: salvage.x + 1, y: salvage.y + 0.5 } : world2.nearest();
  if (nearest && !v.building) {
    c.strokeStyle = salvage ? "#ffda89" : "#a4f8d9";
    c.lineWidth = 1.5;
    c.setLineDash([5, 4]);
    c.strokeRect(ox + (salvage?.x ?? nearest.x) * unit + 1, oy + (salvage?.y ?? nearest.y) * unit + 1, unit * (salvage ? 3 : 1) - 2, unit * (salvage ? 2 : 1) - 2);
    c.setLineDash([]);
  }
  if (v.target) {
    const { x, y } = v.target, size = machineSize({ type: v.tool });
    if (v.building) {
      const invalid = world2.placement(x, y, v.tool);
      c.fillStyle = invalid ? "#ff597147" : "#7afbd742";
      c.fillRect(ox + x * unit, oy + y * unit, unit * size, unit * size);
      c.strokeStyle = invalid ? "#ff7290" : "#91ffe0";
      c.lineWidth = 2;
      c.strokeRect(ox + x * unit, oy + y * unit, unit * size, unit * size);
      c.save();
      c.globalAlpha = 0.6;
      c.translate(ox + x * unit, oy + y * unit);
      c.scale(zoom2, zoom2);
      machineSprite(c, machine(v.tool, x, y, v.direction), world2, true);
      c.restore();
    } else {
      const hovered2 = world2.at(x, y);
      if (hovered2) {
        c.strokeStyle = "#ffffffa0";
        c.lineWidth = 1.5;
        c.strokeRect(ox + hovered2.x * unit, oy + hovered2.y * unit, unit * machineSize(hovered2), unit * machineSize(hovered2));
      }
    }
  }
  c.save();
  c.translate(px, py);
  c.scale(zoom2, zoom2);
  astronaut(c, world2.state.time, v.walking);
  c.restore();
  if (v.mining && nearest) {
    c.strokeStyle = "#ffe2a0";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(px + 5 * zoom2, py + 4 * zoom2);
    c.lineTo(ox + (nearest.x + 0.5) * unit, oy + (nearest.y + 0.5) * unit);
    c.stroke();
    const flicker = (Math.sin(world2.state.time * 45) + 1) / 2;
    c.fillStyle = "#fff5be";
    c.beginPath();
    c.arc(ox + (nearest.x + 0.5) * unit, oy + (nearest.y + 0.5) * unit, 2 + flicker * 2, 0, Math.PI * 2);
    c.fill();
  }
  c.textAlign = "center";
  c.font = "bold 9px Segoe UI,sans-serif";
  c.lineWidth = 3;
  c.strokeStyle = INK;
  c.strokeText("EXPLORADOR", px, py - unit * 0.62);
  c.fillStyle = "#fff0bf";
  c.fillText("EXPLORADOR", px, py - unit * 0.62);
  const shade = c.createRadialGradient(w2 * 0.5, h2 * 0.5, Math.min(w2, h2) * 0.2, w2 * 0.5, h2 * 0.5, Math.max(w2, h2) * 0.65);
  shade.addColorStop(0, "#11112600");
  shade.addColorStop(1, "#11112645");
  c.fillStyle = shade;
  c.fillRect(0, 0, w2, h2);
  if (world2.state.flight) {
    c.fillStyle = "#111d3c55";
    c.fillRect(0, 0, w2, h2);
    c.textAlign = "center";
    c.font = "bold 22px Segoe UI,sans-serif";
    c.fillStyle = "#fff0b7";
    c.fillText("DESPEGUE \xB7 PROGRAMA AURORA", w2 / 2, h2 * 0.22);
    c.font = "12px Segoe UI,sans-serif";
    c.fillStyle = "#daf0ee";
    c.fillText(`Trayecto orbital \xB7 ${Math.round(world2.state.flight.elapsed / 8 * 100)} %`, w2 / 2, h2 * 0.22 + 27);
  }
}


// === INTERFAZ ESPACIAL: cohetes, colonias y cargamentos. ===
// Fuente: cambios/src/ui/space-ui.ts
var el = (id) => document.getElementById(id);
function setupSpaceUI(ctx2) {
  const dialog = el("space-dialog");
  let coloniesKey = "";
  const pad = () => {
    const w2 = ctx2.world(), selected2 = ctx2.selected();
    return selected2?.type === "launchpad" ? selected2 : w2.state.machines.filter((m) => m.type === "launchpad").sort((a, b) => Math.hypot(a.x + 0.5 - w2.state.player.x, a.y + 0.5 - w2.state.player.y) - Math.hypot(b.x + 0.5 - w2.state.player.x, b.y + 0.5 - w2.state.player.y))[0] ?? null;
  };
  function action(run, success, travel = false) {
    if (ctx2.paused()) {
      const message = "Reanud\xE1 la simulaci\xF3n para usar el programa espacial.";
      ctx2.notify(message);
      el("space-notice").textContent = message;
      return;
    }
    const error = run();
    ctx2.notify(error ?? success);
    el("space-notice").textContent = error ?? success;
    if (!error) ctx2.mutated(travel);
    update();
  }
  for (const id of ["cargo-item", "shipment-item"]) el(id).innerHTML = ITEMS.map((i) => `<option value="${i}">${ITEM_NAMES[i]}</option>`).join("");
  function open2() {
    ctx2.opened();
    update();
    if (!dialog.open) dialog.showModal();
  }
  el("space-open").onclick = open2;
  el("platform-open").onclick = open2;
  el("space-close").onclick = () => dialog.close();
  dialog.onclose = ctx2.focus;
  el("rocket-load").onclick = () => {
    const m = pad();
    if (m) action(() => ctx2.world().loadRocketFromInventory(m), "Componentes disponibles cargados en la plataforma.");
  };
  el("rocket-launch").onclick = () => {
    const m = pad();
    if (!m) return;
    action(() => ctx2.world().startLaunch(m), "\xA1Despegue! Rumbo al siguiente planeta.");
    if (ctx2.world().state.flight) dialog.close();
  };
  el("cargo-load").onclick = () => {
    const m = pad();
    if (m) action(() => ctx2.world().loadCargo(m, el("cargo-item").value), "Carga a\xF1adida al cohete.");
  };
  el("cargo-unload").onclick = () => {
    const m = pad();
    if (m) action(() => ctx2.world().unloadCargo(m), "Carga recuperada.");
  };
  el("orbital-upgrade").onclick = () => action(() => ctx2.world().buyOrbitalUpgrade(), "Productividad y capacidad orbital mejoradas.");
  el("colony-list").onclick = (e) => {
    const button = e.target.closest("button[data-planet]");
    if (!button) return;
    action(() => ctx2.world().visit(Number(button.dataset.planet)), "Traslado completado. El inventario local vuelve a estar disponible.", true);
  };
  el("shipment-send").onclick = () => action(() => ctx2.world().sendShipment(Number(el("shipment-target").value), el("shipment-item").value, Number(el("shipment-amount").value)), "Cargamento enviado. Llega en 10 segundos de simulaci\xF3n.");
  function update() {
    const w2 = ctx2.world(), s = w2.state, p = w2.planet(), m = pad(), next = planetInfo(s.highestPlanet + 1, s.originSeed), power = w2.power();
    el("planet-name").textContent = p.name.toUpperCase();
    el("planet-number").textContent = String(s.planet + 1).padStart(2, "0");
    el("space-summary").textContent = s.highestPlanet >= 3 ? `Campa\xF1a completada \xB7 expedici\xF3n ${s.highestPlanet - 2} \xB7 ${s.launches} lanzamientos` : `Campa\xF1a \xB7 ${s.launches}/3 lanzamientos \xB7 pr\xF3ximo destino ${next.name}`;
    el("space-current").textContent = `${p.name} \xB7 ${p.biome === "ice" ? "Hielo" : p.biome === "volcanic" ? "Volc\xE1nico" : "Templado"}`;
    el("planet-description").textContent = p.description;
    el("mission-title").textContent = s.highestPlanet >= 3 ? `Expedici\xF3n infinita ${s.highestPlanet - 2}` : "Campa\xF1a: encender las estrellas";
    el("campaign-progress").innerHTML = ["Aurora \u2192 Borealis", "Borealis \u2192 Vulcan", "Abrir el espacio profundo"].map((name, i) => `<div class="goal ${s.launches > i ? "done" : ""}"><span>${s.launches > i ? "\u2713" : "\u25CB"}</span>${name}</div>`).join("");
    el("rocket-target").textContent = `Destino del pr\xF3ximo lanzamiento: ${next.name}`;
    el("platform-status").textContent = m ? `${w2.status(m, power)} \xB7 (${m.x}, ${m.y})${w2.inReach(m) ? "" : " \xB7 acercate a 4 casillas"}` : w2.hasTech("astronautics") ? "Constru\xED una plataforma con 0. Costo: 6 acero + 4 circuitos + 20 piedra." : "Investig\xE1 Astron\xE1utica en el \xE1rbol T para fabricar componentes y construir la plataforma.";
    const entries = Object.entries(w2.requirements());
    el("rocket-requirements").innerHTML = entries.map(([i, n]) => {
      const have = m?.stock[i] ?? 0;
      return `<div class="rocket-component"><span class="item-label">${itemIcon(i)}${ITEM_NAMES[i]}</span><b>${have.toLocaleString("es-AR")} / ${n.toLocaleString("es-AR")}</b><div class="meter"><i style="width:${Math.min(100, have / n * 100)}%"></i></div></div>`;
    }).join("");
    el("rocket-assembly").textContent = m ? `Ensamblaje: ${Math.round(m.progress / 6 * 100)} % \xB7 requiere 20 kW` : "La plataforma acepta componentes por cintas o desde la mochila.";
    el("rocket-load").disabled = !m || !!s.flight;
    el("rocket-launch").disabled = !m || !w2.inReach(m) || !w2.rocketLoaded(m) || m.progress < 6 - 1e-8 || !(power.ratios.get(m) ?? 0) || !!s.flight;
    el("rocket-launch").textContent = s.flight ? "Lanzamiento en curso" : "Lanzar cohete";
    el("cargo-content").textContent = m ? `${total(m.cargo)} / ${w2.cargoCapacity()} unidades \xB7 ` + ITEMS.filter((i) => m.cargo[i]).map((i) => `${ITEM_NAMES[i]} ${m.cargo[i]}`).join(" \xB7 ") : "Seleccion\xE1 una plataforma para cargar materiales adicionales.";
    el("cargo-load").disabled = !m || !!s.flight;
    el("cargo-unload").disabled = !m || !!s.flight;
    el("orbital-stats").textContent = `${s.credits} cr\xE9ditos \xB7 nivel ${s.orbitalRank} \xB7 productividad \xD7${w2.productivity().toFixed(2)} \xB7 lotes de ${w2.batchSize()} \xB7 carga ${w2.cargoCapacity()}`;
    el("orbital-upgrade").textContent = `Mejorar industria orbital \xB7 ${10 * (s.orbitalRank + 1)} cr\xE9ditos`;
    el("orbital-upgrade").disabled = s.credits < 10 * (s.orbitalRank + 1) || !!s.flight;
    const ids = [s.planet, ...Object.keys(s.colonies).map(Number)].sort((a, b) => a - b), key = `${s.planet}:${ids.join(",")}`;
    if (key !== coloniesKey) {
      coloniesKey = key;
      el("colony-list").innerHTML = ids.map((id) => `<button data-planet="${id}" ${id === s.planet ? "disabled" : ""}>${planetInfo(id, s.originSeed).name}${id === s.planet ? " \xB7 actual" : " \xB7 visitar"}</button>`).join("");
      const select = el("shipment-target"), previous = select.value;
      select.innerHTML = ids.filter((id) => id !== s.planet).map((id) => `<option value="${id}">${planetInfo(id, s.originSeed).name}</option>`).join("");
      if (ids.some((id) => String(id) === previous && id !== s.planet)) select.value = previous;
    }
    el("shipment-send").disabled = ids.length < 2 || !!s.flight;
    el("shipment-amount").max = String(w2.cargoCapacity());
    el("shipment-list").textContent = s.shipments.length ? s.shipments.map((ship) => `${planetInfo(ship.from, s.originSeed).name} \u2192 ${planetInfo(ship.to, s.originSeed).name}: ${total(ship.cargo)} unidades \xB7 ${Math.max(0, Math.ceil(ship.arrival - s.time))} s`).join(" | ") : `${s.deliveredCargo} unidades entregadas \xB7 sin env\xEDos en vuelo`;
  }
  return { open: open2, update };
}


// === INTERFAZ DE INVESTIGACIÓN: tecnologías y recetas. ===
// Fuente: cambios/src/ui/research-map.ts
var el2 = (id) => document.getElementById(id);
var width = 192;
var gap = 60;
var step = width + gap;
var positions = { iron: [0, 60], copper: [0, 150], coal: [0, 240], stone: [0, 330], titanium: [0, 420], crystal: [0, 510], ironPlate: [1, 60], copperPlate: [1, 180], gear: [2, 60], wire: [2, 180], steel: [2, 330], rocketFuel: [2, 480], science: [3, 60], circuit: [3, 180], rocketFrame: [3, 330], alloy: [3, 480], advancedCircuit: [4, 180], rocketEngine: [4, 330], navCore: [5, 300] };
var techPositions = { electronics: [0, 115], logistics: [1, 30], smelting: [1, 275], industry: [2, 115], astronautics: [3, 115], interstellar: [4, 115] };
var techWidth = 246;
var techStep = 308;
var rawDescription = { iron: "Mena b\xE1sica para placas y construcci\xF3n.", copper: "Mena para placas, postes y laboratorios.", coal: "Combustible de hornos y generadores; ingrediente del acero y combustible s\xF3lido.", stone: "Material de construcci\xF3n. Cada tramo de cinta consume una piedra.", titanium: "Se encuentra en Borealis. Necesario para los cohetes posteriores al primero.", crystal: "Se encuentra en Vulcan. Necesario para los n\xFAcleos de navegaci\xF3n." };
function setupResearchMap(getWorld) {
  let view = "technology", selected2 = "", lastKey = "";
  const nodes = Object.entries(positions).map(([id, [col, y]]) => ({ id, x: 24 + col * step, y, label: ITEM_NAMES[id], kind: col === 0 ? "raw" : "recipe", item: id, recipe: Object.keys(RECIPES).find((r) => Object.hasOwn(RECIPES[r].output, id)) }));
  nodes.push({ id: "generator", x: 24 + step, y: 330, label: "Generaci\xF3n el\xE9ctrica", kind: "support" }, { id: "construction", x: 24 + step, y: 480, label: "Construcci\xF3n", kind: "support" }, { id: "rocket", x: 24 + 6 * step, y: 300, label: "Pr\xF3ximo cohete", kind: "goal" });
  nodes.push({ id: "research", x: 24 + 4 * step, y: 60, label: "Laboratorio y tecnolog\xEDas", kind: "support" });
  const edges = [];
  for (const n of nodes) if (n.recipe) for (const [from, amount] of Object.entries(RECIPES[n.recipe].input)) edges.push({ from, to: n.id, amount });
  edges.push({ from: "iron", to: "ironPlate", amount: 1 }, { from: "copper", to: "copperPlate", amount: 1 }, { from: "coal", to: "generator", amount: 1 }, ...["iron", "copper", "stone"].map((from) => ({ from, to: "construction", amount: 0 })));
  edges.push({ from: "coal", to: "ironPlate", amount: 0, utility: true }, { from: "coal", to: "copperPlate", amount: 0, utility: true }, { from: "science", to: "research", amount: 1 }, { from: "generator", to: "research", amount: 0, utility: true });
  function path(x1, y1, x2, y2) {
    const bend = Math.max(30, (x2 - x1) * 0.5);
    return `M ${x1} ${y1} C ${x1 + bend} ${y1},${x2 - bend} ${y2},${x2} ${y2}`;
  }
  const defs = '<defs><marker id="recipe-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/></marker></defs>';
  el2("recipe-map").innerHTML = `<svg class="map-wires" width="1776" height="610" aria-hidden="true">${defs}<g id="recipe-wires"></g></svg>` + ["MENAS", "FUNDICI\xD3N Y BASE", "MEC\xC1NICA", "INDUSTRIA", "ASTRON\xC1UTICA", "NAVEGACI\xD3N", "DESTINO"].map((s, i) => `<span class="map-column" style="left:${24 + i * step}px">${s}</span>`).join("") + nodes.map((n) => `<button class="recipe-node ${n.kind}" data-node="${n.id}" style="left:${n.x}px;top:${n.y}px;--item:${n.item ? ITEM_COLORS[n.item] : "#ffce79"}">${n.item ? itemIcon(n.item) : '<span class="recipe-dot"></span>'}<strong>${n.label}</strong><small id="node-status-${n.id}"></small></button>`).join("");
  const techEdges = TECH_IDS.flatMap((to) => TECHS[to].requires.map((from) => {
    const [a, ay] = techPositions[from], [b, by] = techPositions[to];
    return `<path marker-end="url(#tech-arrow)" data-tech-edge="${from}:${to}" d="${path(24 + a * techStep + techWidth, ay + 96, 24 + b * techStep, by + 96)}"/>`;
  })).join("");
  el2("tech-tree").innerHTML = `<svg class="map-wires tech-wires" width="1530" height="520" aria-hidden="true">${defs.replaceAll("recipe-arrow", "tech-arrow")}${techEdges}</svg>` + TECH_IDS.map((id) => {
    const [col, y] = techPositions[id], recipes = Object.values(RECIPES).filter((r) => r.tech === id).map((r) => Object.keys(r.output)[0]);
    return `<article class="tech-card" id="tech-${id}" style="left:${24 + col * techStep}px;top:${y}px"><div class="tech-level">${col === 0 ? "01 \xB7 ELECTR\xD3NICA" : col === 1 ? "02 \xB7 ESPECIALIZACI\xD3N" : col === 2 ? "03 \xB7 INDUSTRIA" : col === 3 ? "04 \xB7 ASTRON\xC1UTICA" : "05 \xB7 NAVEGACI\xD3N"}</div><h3>${TECHS[id].name}</h3><p>${TECHS[id].description}</p><div class="tech-unlocks">${recipes.map((r) => `<button class="tech-recipe" data-recipe="${r}">${itemIcon(r)}${ITEM_NAMES[r]}</button>`).join("")}</div><div class="tech-prerequisites">Requiere: ${TECHS[id].requires.map((t) => TECHS[t].name).join(" + ") || "Laboratorio con paquetes cient\xEDficos"}</div><div class="meter"><i id="tech-meter-${id}"></i></div><div class="tech-bottom"><span id="tech-progress-${id}"></span><button id="research-${id}">Investigar</button></div></article>`;
  }).join("");
  function setView(next) {
    view = next;
    for (const id of ["technology", "recipes"]) {
      el2(`map-view-${id}`).hidden = id !== view;
      el2(`map-tab-${id}`).setAttribute("aria-selected", String(id === view));
    }
    el2("map-direction").textContent = view === "recipes" ? "Menas \u2192 transformaci\xF3n \u2192 componentes \u2192 cohete. Toc\xE1 un recurso para seguir sus conexiones." : "Investigaci\xF3n de izquierda a derecha. Las dos ramas centrales deben completarse antes de Industria eficiente.";
  }
  el2("map-tab-technology").onclick = () => setView("technology");
  el2("map-tab-recipes").onclick = () => setView("recipes");
  for (const id of ["technology", "recipes"]) el2(`map-tab-${id}`).onkeydown = (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next = id === "technology" ? "recipes" : "technology";
      setView(next);
      el2(`map-tab-${next}`).focus();
    }
  };
  el2("tech-tree").onclick = (e) => {
    const button = e.target.closest("[data-recipe]");
    if (button) {
      selected2 = button.dataset.recipe;
      setView("recipes");
      lastKey = "";
      update();
      const node = el2("recipe-map").querySelector(`[data-node="${selected2}"]`);
      node.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
      node.focus({ preventScroll: true });
    }
  };
  el2("map-left").onclick = () => el2(view === "recipes" ? "recipe-scroll" : "technology-scroll").scrollBy({ left: -500, behavior: "smooth" });
  el2("map-right").onclick = () => el2(view === "recipes" ? "recipe-scroll" : "technology-scroll").scrollBy({ left: 500, behavior: "smooth" });
  el2("map-clear").onclick = () => {
    selected2 = "";
    lastKey = "";
    update();
  };
  el2("recipe-map").onclick = (e) => {
    const button = e.target.closest("[data-node]");
    if (button) {
      selected2 = button.dataset.node;
      lastKey = "";
      update();
    }
  };
  el2("recipe-details").onclick = (e) => {
    const button = e.target.closest("[data-tech]");
    if (button) {
      setView("technology");
      el2(`tech-${button.dataset.tech}`).scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
      el2(`research-${button.dataset.tech}`).focus({ preventScroll: true });
    }
  };
  function update() {
    const w2 = getWorld(), s = w2.state, key = JSON.stringify([s.unlocked, s.research, s.techProgress, s.highestPlanet, selected2]);
    if (key === lastKey) return;
    lastKey = key;
    const stages = [{ name: "01 \xB7 Exploraci\xF3n", text: "Personaje y mundo minero", done: true }, { name: "02 \xB7 Automatizaci\xF3n", text: "Minera \u2192 cinta \u2192 horno", done: s.smelted > 0 || s.production.ironPlate > 0 || s.unlocked.length > 0 }, { name: "03 \xB7 Industria", text: "Energ\xEDa y componentes", done: s.production.gear > 0 || s.unlocked.length > 0 }, { name: "04 \xB7 Investigaci\xF3n", text: "Ciencia e Industria eficiente", done: w2.hasTech("industry") }, { name: "05 \xB7 Primer cohete", text: "Astron\xE1utica \u2192 Borealis", done: s.highestPlanet >= 1 }, { name: "06 \xB7 Colonias", text: "Titanio \u2192 Vulcan \u2192 cristales", done: s.highestPlanet >= 3 }, { name: "07 \xB7 Espacio profundo", text: "Expediciones y mejoras orbitales", done: false }];
    const current = stages.findIndex((p) => !p.done);
    el2("development-phases").innerHTML = stages.map((p, i) => `<div class="phase-step ${p.done ? "done" : i === current ? "current" : "future"}"><strong>${p.done ? "\u2713 " : i === current ? "\u25C6 " : "\u25CB "}${p.name}</strong><span>${p.text}</span><small>${p.done ? "Completada" : i === current ? "Etapa actual" : "Siguiente etapa"}</small></div>`).join("");
    for (const edge of Array.from(el2("tech-tree").querySelectorAll("[data-tech-edge]"))) {
      const [from, to] = edge.dataset.techEdge.split(":");
      edge.classList.toggle("complete", w2.hasTech(to));
      edge.classList.toggle("available", w2.hasTech(from) && !w2.hasTech(to));
    }
    const rocketEdges = Object.entries(w2.requirements()).map(([from, amount]) => ({ from, to: "rocket", amount })), allEdges = [...edges, ...rocketEdges], related = new Set(selected2 ? [selected2] : nodes.map((n2) => n2.id));
    if (selected2) {
      for (const direction2 of ["up", "down"]) {
        const visited = /* @__PURE__ */ new Set([selected2]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const edge of allEdges) {
            const from = direction2 === "up" ? edge.to : edge.from, to = direction2 === "up" ? edge.from : edge.to;
            if (visited.has(from) && !visited.has(to)) {
              visited.add(to);
              changed = true;
            }
          }
        }
        for (const id of visited) related.add(id);
      }
    }
    el2("recipe-wires").innerHTML = allEdges.map((edge) => {
      const from = nodes.find((n2) => n2.id === edge.from), to = nodes.find((n2) => n2.id === edge.to), highlight = !selected2 || related.has(edge.from) && related.has(edge.to);
      return `<g class="recipe-edge ${highlight ? "traced" : "dimmed"} ${"utility" in edge && edge.utility ? "utility" : ""}"><path d="${path(from.x + width, from.y + 32, to.x, to.y + 32)}" marker-end="url(#recipe-arrow)"/><title>${from.label} \u2192 ${to.label}${edge.amount ? " \xB7 " + edge.amount : ""}</title></g>`;
    }).join("");
    for (const n2 of nodes) {
      const button = el2("recipe-map").querySelector(`[data-node="${n2.id}"]`);
      button.classList.toggle("dimmed", !related.has(n2.id));
      button.classList.toggle("chosen", n2.id === selected2);
      button.setAttribute("aria-pressed", String(n2.id === selected2));
      const tech2 = n2.recipe ? RECIPES[n2.recipe].tech : null, locked = !!tech2 && !w2.hasTech(tech2);
      button.classList.toggle("locked", locked);
      el2(`node-status-${n2.id}`).textContent = n2.id === "rocket" ? `Destino: ${planetInfo(s.highestPlanet + 1, s.originSeed).name}` : tech2 ? locked ? `\u25C7 ${TECHS[tech2].name}` : "\u2713 Receta desbloqueada" : n2.item === "titanium" ? "Borealis \xB7 mena" : n2.item === "crystal" ? "Vulcan \xB7 mena" : n2.kind === "raw" ? "Extracci\xF3n" : n2.item === "ironPlate" || n2.item === "copperPlate" ? "Horno \xB7 carb\xF3n" : n2.id === "generator" ? "Carb\xF3n \u2192 electricidad" : n2.id === "construction" ? "Edificios y cintas" : n2.id === "research" ? "Ciencia + electricidad" : "Receta inicial";
    }
    const n = nodes.find((n2) => n2.id === selected2);
    if (!n) {
      el2("recipe-details").innerHTML = '<div><span class="eyebrow">CADENA COMPLETA</span><h3>De la mena al espacio</h3><p>Seleccion\xE1 un nodo para ver cantidades, requisitos tecnol\xF3gicos y usos. Las flechas muestran qu\xE9 recurso alimenta a cada producto.</p></div>';
      return;
    }
    const recipe = n.recipe ? RECIPES[n.recipe] : null, tech = recipe?.tech, inputs = recipe ? Object.entries(recipe.input) : n.id === "ironPlate" ? [["iron", 1]] : n.id === "copperPlate" ? [["copper", 1]] : n.id === "rocket" ? Object.entries(w2.requirements()) : [], outputs = recipe ? Object.entries(recipe.output) : [];
    const uses = allEdges.filter((e) => e.from === n.id).map((e) => nodes.find((v) => v.id === e.to).label);
    let description = rawDescription[n.item] ?? "";
    if (n.id === "research") description = "Los laboratorios consumen paquetes cient\xEDficos y necesitan 12 kW. Cada paquete tarda 2 s base. La investigaci\xF3n desbloquea recetas y mejoras; eleg\xED una rama en la vista Tecnolog\xEDas.";
    if (n.id === "generator") description = "El generador quema carb\xF3n y distribuye electricidad a trav\xE9s de postes. Mineras, ensambladoras, laboratorios y plataformas necesitan suministro.";
    if (n.id === "construction") description = Object.entries(COSTS).map(([type, cost]) => `${MACHINE_NAMES[type]}: ${Object.entries(cost).map(([i, q]) => `${q} ${ITEM_NAMES[i]}`).join(" + ")}`).join(" \xB7 ");
    if (n.id === "rocket") description = `Requisitos del pr\xF3ximo lanzamiento a ${planetInfo(s.highestPlanet + 1, s.originSeed).name}. Plataforma 2 \xD7 2, ensamblaje de 6 s y 20 kW. Las cantidades aumentan con cada lanzamiento.`;
    if (n.id === "ironPlate" || n.id === "copperPlate") description = "Horno: 1 mena \u2192 1 placa en 2 s base. Un carb\xF3n permite fundir 4 placas.";
    el2("recipe-details").innerHTML = `<div><span class="eyebrow">${n.kind === "raw" ? "RECURSO" : n.kind === "goal" ? "OBJETIVO ESPACIAL" : "RECETA Y DEPENDENCIAS"}</span><h3>${n.label}</h3>${description ? `<p>${description}</p>` : ""}${inputs.length ? `<div class="recipe-formula">${inputs.map(([i, q]) => `<span class="item-label">${itemIcon(i)}${q} ${ITEM_NAMES[i]}</span>`).join("<b> + </b>")}${outputs.length ? `<b> \u2192 </b>${outputs.map(([i, q]) => `<span class="item-label">${itemIcon(i)}${q} ${ITEM_NAMES[i]}</span>`).join(" + ")}` : ""}</div>` : ""}${recipe ? `<p>Ensambladora \xB7 ${recipe.seconds} s base \xB7 10 kW. Los tiempos y lotes reciben tus mejoras industriales.</p>` : ""}${uses.length ? `<p><strong>Se utiliza en:</strong> ${uses.join(" \xB7 ")}.</p>` : ""}</div><div class="recipe-gate">${tech ? `<span class="gate-badge ${w2.hasTech(tech) ? "ready" : ""}">${w2.hasTech(tech) ? "\u2713 Desbloqueada" : "\u25C7 Requiere investigaci\xF3n"}</span><button data-tech="${tech}">Ver ${TECHS[tech].name} \u2192</button>` : '<span class="gate-badge ready">Consult\xE1 las conexiones de izquierda a derecha</span>'}</div>`;
  }
  setView("technology");
  return { update };
}


// === TUTORIAL: objetivos y comprobación de pasos. ===
// Fuente: cambios/src/gameplay/tutorial.ts
function tutorialState() {
  const s = createState("aurora-01");
  s.player = { x: 51.5, y: 50.5 };
  s.salvage = { x: 49, y: 47, starter: 0, industrial: 0 };
  return s;
}
var TUTORIAL_STEPS = [
  { title: "Recuper\xE1 tu nave", text: "Tu nave qued\xF3 accidentada junto al personaje. Puls\xE1 el bot\xF3n para preparar la herramienta y manten\xE9 E unos 5 segundos: desarmar\xE1s los restos y recuperar\xE1s los materiales para la primera f\xE1brica.", action: "Preparar desguace \xB7 E", type: "wreck", x: 49, y: 47, focus: "world" },
  { title: "Constru\xED una minera", text: "Eleg\xED Minera con 1 o el bot\xF3n de abajo. Hac\xE9 clic sobre la mena de hierro marcada. Su flecha debe mirar al este \u2192; R gira la salida.", action: "Elegir minera \xB7 1", type: "miner", x: 51, y: 48, focus: "tool-miner" },
  { title: "Conect\xE1 una cinta", text: "Eleg\xED Cinta con 2 y colocala en la casilla marcada, a la derecha de la minera. La flecha \u2192 lleva el hierro hacia el horno.", action: "Elegir cinta \xB7 2", type: "belt", x: 52, y: 48, focus: "tool-belt" },
  { title: "Agreg\xE1 un horno", text: "Eleg\xED Horno con 3 y constru\xED en la casilla marcada. Recibe el mineral de la cinta y lo convierte en placas usando carb\xF3n.", action: "Elegir horno \xB7 3", type: "furnace", x: 53, y: 48, focus: "tool-furnace" },
  { title: "Guard\xE1 la producci\xF3n", text: "Eleg\xED Cofre con 4 y colocalo a la derecha del horno. Los edificios tambi\xE9n pueden conectarse directamente, sin una cinta en el medio.", action: "Elegir cofre \xB7 4", type: "chest", x: 54, y: 48, focus: "tool-chest" },
  { title: "Dale energ\xEDa a la minera", text: "Eleg\xED Generador con 5 y constru\xED en la casilla marcada. Est\xE1 lo bastante cerca para alimentar la minera; los postes permiten extender la red.", action: "Elegir generador \xB7 5", type: "generator", x: 50, y: 47, focus: "tool-generator" },
  { title: "Encend\xE9 el generador", text: "Sal\xED de construcci\xF3n con B y hac\xE9 clic en el generador, o us\xE1 Inspeccionar. En su panel, puls\xE1 Cargar 5 con Carb\xF3n seleccionado. La minera empezar\xE1 a extraer.", action: "Inspeccionar generador", type: "generator", x: 50, y: 47, focus: "load-material" },
  { title: "Carg\xE1 carb\xF3n en el horno", text: "Inspeccion\xE1 el horno y puls\xE1 Carb\xF3n en su panel. El generador da electricidad; el horno necesita su propio carb\xF3n para fundir el hierro.", action: "Inspeccionar horno", type: "furnace", x: 53, y: 48, focus: "load-coal" },
  { title: "Recog\xE9 tu primera placa", text: "Esper\xE1 unos segundos: minera \u2192 cinta \u2192 horno \u2192 cofre. Inspeccion\xE1 el cofre y puls\xE1 Recoger del cofre para llevar las placas a tu mochila.", action: "Inspeccionar cofre", type: "chest", x: 54, y: 48, focus: "collect" }
];
function tutorialStepDone(w2, index, collectedFromChest = false) {
  if (index < 0 || index >= TUTORIAL_STEPS.length) return false;
  if (index === 0) return w2.state.kitClaimed && w2.state.industrialKit;
  const step2 = TUTORIAL_STEPS[index], m = w2.at(step2.x, step2.y);
  if (!m || m.type !== step2.type) return false;
  if (index < 6) return m.dir === 0;
  if (index === 6 || index === 7) return m.stock.coal > 0 || m.fuel > 0;
  return collectedFromChest && w2.state.inventory.ironPlate > 0 && w2.state.smelted > 0;
}


// === INTERFAZ DEL TUTORIAL: indicaciones y controles. ===
// Fuente: cambios/src/ui/tutorial-ui.ts
var el3 = (id) => document.getElementById(id);
function setupTutorialUI(ctx2) {
  let index = 0, lastKey = "", highlight = null, collected = false;
  const panel = el3("tutorial-card"), target2 = el3("tutorial-target");
  el3("tutorial-exit").onclick = ctx2.exit;
  el3("tutorial-restart").onclick = ctx2.restart;
  el3("tutorial-action").onclick = () => {
    if (index === TUTORIAL_STEPS.length) {
      ctx2.research();
      return;
    }
    const step2 = TUTORIAL_STEPS[index];
    ctx2.prepare(step2.type, step2.x, step2.y, index > 0 && index < 6);
  };
  el3("tutorial-finish").onclick = ctx2.exit;
  function clearHighlight() {
    highlight?.classList.remove("tutorial-focus");
    highlight = null;
  }
  function update() {
    const active = ctx2.active();
    panel.hidden = !active;
    target2.hidden = !active || index === TUTORIAL_STEPS.length;
    if (!active) {
      clearHighlight();
      lastKey = "";
      return;
    }
    while (index < TUTORIAL_STEPS.length && tutorialStepDone(ctx2.world(), index, collected)) index++;
    const key = `${index}:${ctx2.paused()}`;
    if (key === lastKey) return;
    lastKey = key;
    clearHighlight();
    const done = index === TUTORIAL_STEPS.length, step2 = TUTORIAL_STEPS[index];
    el3("tutorial-progress").textContent = done ? "PRIMERA F\xC1BRICA COMPLETADA" : `APREND\xC9 HACIENDO \xB7 ${index + 1} / ${TUTORIAL_STEPS.length}`;
    el3("tutorial-meter").style.width = `${index / TUTORIAL_STEPS.length * 100}%`;
    el3("tutorial-title").textContent = done ? "\xA1Tu f\xE1brica ya produce!" : step2.title;
    el3("tutorial-instruction").textContent = done ? "Construiste una l\xEDnea completa y recogiste tus primeras placas. El \xE1rbol de tecnolog\xEDas muestra las pr\xF3ximas recetas y etapas. Pod\xE9s volver a tu partida cuando quieras." : step2.text;
    el3("tutorial-action").textContent = done ? "Ver recetas y tecnolog\xEDas \xB7 T" : step2.action;
    el3("tutorial-finish").hidden = !done;
    el3("tutorial-paused").hidden = !ctx2.paused();
    if (!done) {
      highlight = el3(step2.focus);
      highlight.classList.add("tutorial-focus");
      target2.dataset.label = `${index + 1} \xB7 ${index === 0 ? "Manten\xE9 E" : index < 6 ? "Constru\xED ac\xE1" : "Inspeccion\xE1 ac\xE1"}`;
    }
  }
  function draw(view) {
    if (!ctx2.active() || index >= TUTORIAL_STEPS.length) {
      target2.hidden = true;
      return;
    }
    const step2 = TUTORIAL_STEPS[index], unit = 32 * view.zoom, left = view.w / 2 + (step2.x - view.camera.x) * unit, top = view.h / 2 + (step2.y - view.camera.y) * unit;
    target2.hidden = left < 0 || top < 0 || left + unit > view.w || top + unit > view.h;
    target2.style.left = `${left}px`;
    target2.style.top = `${top}px`;
    target2.style.width = `${unit * (index === 0 ? 3 : 1)}px`;
    target2.style.height = `${unit * (index === 0 ? 2 : 1)}px`;
  }
  return { update, draw, recordCollection: (m) => {
    if (ctx2.active() && m.type === "chest" && m.x === 54 && m.y === 48) collected = true;
  }, start: () => {
    index = 0;
    collected = false;
    lastKey = "";
    clearHighlight();
  } };
}


// === MENÚ PRINCIPAL: inicio, carga y opciones. ===
// Fuente: cambios/src/ui/main-menu.ts
var el4 = (id) => document.getElementById(id);
function randomSeed() {
  return Math.random().toString(36).slice(2, 10).toUpperCase().padEnd(8, "0");
}
function setupMainMenu(ctx2) {
  const dialog = el4("main-menu");
  let busy = false;
  function page(name) {
    for (const id of ["home", "new", "options", "controls", "training"]) el4(`menu-${id}`).hidden = id !== name;
    el4("menu-notice").textContent = "";
  }
  function update() {
    for (const id of ["menu-resume", "menu-new-button", "menu-tutorial", "menu-options-button", "menu-controls-button"]) el4(id).disabled = busy;
    const saved = ctx2.saved();
    el4("menu-resume").hidden = !ctx2.canResume();
    el4("menu-load").disabled = !saved || busy;
    el4("menu-save-summary").textContent = saved ? `${planetInfo(saved.planet, saved.originSeed).name} \xB7 ${saved.machines.length} m\xE1quinas \xB7 ${saved.launches} lanzamientos \xB7 semilla ${saved.originSeed}` : "Todav\xEDa no hay una partida guardada en este navegador.";
    el4("menu-new-warning").textContent = saved ? "Se utiliza un guardado local. Antes de reemplazarlo te pediremos confirmaci\xF3n." : "Eleg\xED una semilla para generar los yacimientos de tu nueva expedici\xF3n.";
    const options = ctx2.options();
    el4("menu-zoom").value = String(options.zoom);
    if (!el4("menu-zoom").value) el4("menu-zoom").value = "1.45";
    el4("menu-coverage").checked = options.coverage;
    el4("menu-motion").checked = options.motion;
  }
  function close() {
    dialog.close();
  }
  function open2() {
    page("home");
    update();
    if (!dialog.open) dialog.showModal();
  }
  dialog.oncancel = (e) => {
    if (busy || !ctx2.canResume()) e.preventDefault();
  };
  dialog.onclose = ctx2.closed;
  el4("menu-random-seed").onclick = () => {
    const input = el4("menu-seed");
    let next;
    do {
      next = randomSeed();
    } while (next === input.value);
    input.value = next;
  };
  el4("menu-resume").onclick = close;
  el4("menu-new-button").onclick = () => {
    page("new");
    const seed = el4("menu-seed");
    seed.value = randomSeed();
    seed.focus();
  };
  for (const id of ["options", "controls", "training"]) el4(`menu-${id}-button`).onclick = () => {
    update();
    page(id);
  };
  for (const button of Array.from(dialog.querySelectorAll("[data-menu-back]"))) button.onclick = () => page("home");
  el4("menu-new").onsubmit = (e) => {
    e.preventDefault();
    const seed = el4("menu-seed").value.trim();
    if (seed) ctx2.newGame(seed);
  };
  el4("menu-tutorial").onclick = () => {
    close();
    ctx2.tutorial();
  };
  el4("menu-load").onclick = async () => {
    if (busy) return;
    busy = true;
    update();
    el4("menu-notice").textContent = "Cargando partida\u2026";
    try {
      const error = await ctx2.load();
      if (error) el4("menu-notice").textContent = error;
      else close();
    } catch {
      el4("menu-notice").textContent = "No se pudo acceder al guardado. Intent\xE1 cargarlo de nuevo.";
    } finally {
      busy = false;
      update();
    }
  };
  function apply() {
    const options = { zoom: Number(el4("menu-zoom").value), coverage: el4("menu-coverage").checked, motion: el4("menu-motion").checked };
    ctx2.applyOptions(options);
    try {
      localStorage.setItem("rocket-mining-options", JSON.stringify(options));
      el4("menu-options-status").textContent = "Opciones guardadas en este navegador.";
    } catch {
      el4("menu-options-status").textContent = "Opciones aplicadas para esta sesi\xF3n.";
    }
  }
  for (const id of ["menu-zoom", "menu-coverage", "menu-motion"]) el4(id).onchange = apply;
  try {
    const options = JSON.parse(localStorage.getItem("rocket-mining-options") ?? "null");
    if (options && [0.8, 1, 1.45, 2, 2.6].includes(options.zoom) && typeof options.coverage === "boolean" && typeof options.motion === "boolean") ctx2.applyOptions(options);
  } catch {
  }
  return { open: open2, close, update, isOpen: () => dialog.open };
}


// === CONTROL PRINCIPAL: eventos, actualización, guardado y conexión entre sistemas. ===
// Fuente: cambios/src/main.ts
var el5 = (id) => document.getElementById(id);
var canvas = el5("world");
var ctx = canvas.getContext("2d");
var world = new World(createState());
var paused = false;
var building = false;
var tool = "miner";
var direction = 0;
var selected = null;
var realState = null;
var demoKind = null;
var hasSession = false;
var returnToMenuAfterDemo = false;
var storedSave = null;
var sessionOnly = false;
var showPower = false;
var dragLast = null;
var inspected = null;
var samples = [];
var lastSample = -1;
var zoom = 1.45;
var w = 1;
var h = 1;
var dpr = 1;
var manual = 0;
var last = 0;
var acc = 0;
var autosave = 0;
var uiTime = 0;
var keys = /* @__PURE__ */ new Set();
var mouse = null;
var camera = { x: 48.5, y: 48.5 };
function toast(message) {
  el5("toast").textContent = message;
}
try {
  const restored = await load();
  if (restored) {
    storedSave = structuredClone(restored);
    world = new World(restored);
    toast("Partida encontrada. Eleg\xED Cargar partida en el men\xFA.");
  }
} catch {
  toast("No se pudo cargar la partida. Revis\xE1 el acceso al almacenamiento del navegador.");
}
camera.x = world.state.player.x;
camera.y = world.state.player.y;
el5("seed").value = randomSeed2();
async function persist() {
  if (!hasSession) return false;
  if (realState) {
    el5("save-status").textContent = "Demostraci\xF3n \xB7 no se guarda";
    return false;
  }
  if (sessionOnly) {
    el5("save-status").textContent = "Sesi\xF3n temporal \xB7 sin guardado";
    return false;
  }
  try {
    const snapshot = structuredClone(world.state);
    await save(snapshot);
    storedSave = snapshot;
    el5("save-status").textContent = "Guardado " + (/* @__PURE__ */ new Date()).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    return true;
  } catch {
    el5("save-status").textContent = "Error al guardar";
    toast("No se pudo guardar. El navegador no permiti\xF3 acceder al almacenamiento.");
    return false;
  }
}
var costText = (type) => Object.entries(COSTS[type]).map(([i, n]) => `${n} ${ITEM_NAMES[i].toLowerCase()}`).join(" + ");
function setMode(value) {
  building = value;
  dragLast = null;
  el5("mode").classList.toggle("active", value);
  el5("mode").textContent = value ? "B \xB7 Terminar construcci\xF3n" : "B \xB7 Construir";
  el5("mode-label").textContent = value ? "CONSTRUCCI\xD3N" : "EXPLORACI\xD3N";
  canvas.style.cursor = value ? "crosshair" : "default";
  updateUI();
}
function selectTool(type) {
  tool = type;
  setMode(true);
  toast(`${MACHINE_NAMES[type]}: ${costText(type)}. ${type === "belt" ? "Arrastr\xE1 para trazar curvas autom\xE1ticas." : "R gira la salida; clic coloca."}`);
  canvas.focus();
}
function pause() {
  paused = !paused;
  keys.clear();
  el5("paused").hidden = !paused;
  el5("pause").textContent = paused ? "Continuar" : "Pausar";
}
function resize() {
  const r = canvas.getBoundingClientRect();
  w = r.width;
  h = r.height;
  dpr = Math.min(devicePixelRatio, 2);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  limitZoom();
}
function limitZoom() {
  zoom = Math.max(0.4, Math.max(w, h) / (SIZE * 32), Math.min(2.6, zoom));
}
function changeZoom(factor) {
  zoom *= factor;
  limitZoom();
  updateUI();
}
new ResizeObserver(resize).observe(canvas);
function target() {
  if (!mouse) return null;
  const unit = 32 * zoom;
  return { x: Math.floor(camera.x + (mouse.x - w / 2) / unit), y: Math.floor(camera.y + (mouse.y - h / 2) / unit) };
}
function hovered() {
  const t = target();
  return t ? world.at(t.x, t.y) : void 0;
}
function showInspector() {
  const dialog = el5("inspector");
  if (!dialog.open && !document.querySelector("dialog[open]")) {
    keys.clear();
    dragLast = null;
    el5("machine-feedback").textContent = "";
    dialog.showModal();
  }
}
function interactMachine() {
  const m = hovered() ?? selected ?? world.state.machines.filter((m2) => world.inReach(m2)).sort((a, b) => Math.hypot(a.x + 0.5 - world.state.player.x, a.y + 0.5 - world.state.player.y) - Math.hypot(b.x + 0.5 - world.state.player.x, b.y + 0.5 - world.state.player.y))[0];
  if (m) {
    selected = m;
    toast("M\xE1quina seleccionada. Us\xE1 su panel para cargar, recoger o desmontar.");
    updateUI();
    showInspector();
  } else toast("Acercate a una m\xE1quina para inspeccionarla.");
}
function rotate() {
  if (paused || world.state.flight) return;
  if (building) direction = (direction + 1) % 4;
  else {
    const m = hovered() ?? selected;
    if (!m) return;
    if (!world.inReach(m)) {
      toast("Acercate para girar la salida.");
      return;
    }
    m.dir = (m.dir + 1) % 4;
  }
  updateUI();
}
function dismantle(m = hovered() ?? selected) {
  if (!m) return;
  if (paused) {
    toast("Reanud\xE1 la simulaci\xF3n para desmontar.");
    return;
  }
  const error = world.remove(m);
  toast(error ?? `Desmontaste: ${MACHINE_NAMES[m.type]}. Materiales y contenido recuperados.`);
  if (!error && selected === m) selected = null;
  updateUI();
}
window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "i" && !e.repeat && !e.target.closest("input,textarea,select") && (el5("inventory-dialog").open || !document.querySelector("dialog[open]"))) {
    e.preventDefault();
    toggleInventory();
    return;
  }
  if (e.target.closest("input,textarea,select,button,summary,dialog")) return;
  const key = e.key.toLowerCase();
  if (e.altKey || e.ctrlKey || e.metaKey) {
    keys.clear();
    return;
  }
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) e.preventDefault();
  if (e.repeat) return;
  keys.add(key);
  if (world.state.flight && key !== " ") return;
  if (key === "e" && world.canSalvage()) setMode(false);
  if (key === "b") setMode(!building);
  if (key === "escape") setMode(false);
  if (key === " ") pause();
  if (key === "r") rotate();
  if (key === "x") dismantle();
  if (key === "f") interactMachine();
  if (key === "p") {
    showPower = !showPower;
    updateUI();
  }
  if (key === "t") openResearch();
  if (key === "o") spaceUI.open();
  if (key === "0") selectTool("launchpad");
  if (key === "q") selectTool("inserter");
  const index = Number(key) - 1;
  if (index >= 0 && index < TYPES.length) selectTool(TYPES[index]);
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => {
  keys.clear();
  dragLast = null;
  last = 0;
  acc = 0;
});
window.addEventListener("focus", () => {
  keys.clear();
  last = 0;
  acc = 0;
  if (!document.querySelector("dialog[open]") && !document.activeElement?.closest("input,textarea,select")) canvas.focus({ preventScroll: true });
});
document.addEventListener("visibilitychange", () => {
  keys.clear();
  last = 0;
  acc = 0;
  if (document.hidden) void persist();
});
function updateOreHint() {
  const hint = el5("ore-hint"), t = target(), tile2 = t && world.tile(t.x, t.y), wreck = t && world.wreckAt(t.x, t.y), m = hovered();
  hint.hidden = !mouse || building && !m || !tile2?.resource && !wreck && !m || !!document.querySelector("dialog[open]");
  if (hint.hidden || !mouse || !tile2) return;
  const text = m ? `${MACHINE_NAMES[m.type]} \xB7 ${world.status(m)}
` + machineDiagnostics(world, m).map((d) => `${d.warning ? "\u26A0" : "\u2022"} ${d.kind}: ${d.message}`).join("\n") : wreck ? "Nave accidentada \xB7 mantener E" : `${ITEM_NAMES[tile2.resource]} \xB7 ${tile2.amount === 0 ? "agotada" : `reserva en esta casilla: ${tile2.amount.toLocaleString("es-AR")} unidades`}`;
  if (hint.textContent !== text) hint.textContent = text;
  hint.style.setProperty("--ore-color", m ? "#ffcf83" : wreck ? "#ffcf83" : ITEM_COLORS[tile2.resource]);
  hint.style.left = `${Math.max(8, Math.min(w - hint.offsetWidth - 8, mouse.x + 16))}px`;
  hint.style.top = `${Math.max(8, Math.min(h - hint.offsetHeight - 8, mouse.y + 20))}px`;
}
function updatePointer(e) {
  const r = canvas.getBoundingClientRect();
  mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
  updateOreHint();
}
canvas.addEventListener("pointermove", (e) => {
  updatePointer(e);
  if (!dragLast || !(e.buttons & 1) || !building || tool !== "belt" || paused) return;
  const t = target();
  if (!t) return;
  let previous = dragLast;
  for (let i = 0; i < 32 && (previous.x !== t.x || previous.y !== t.y); i++) {
    const dx = t.x - previous.x, dy = t.y - previous.y;
    const next = { x: previous.x + (Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0), y: previous.y + (Math.abs(dx) < Math.abs(dy) ? Math.sign(dy) : 0) };
    const error = world.extendBelt(previous, next, direction);
    if (error) {
      toast(error);
      break;
    }
    previous = next;
    dragLast = next;
  }
  updateUI();
});
canvas.addEventListener("pointerleave", (e) => {
  mouse = null;
  el5("ore-hint").hidden = true;
  if (!canvas.hasPointerCapture(e.pointerId)) dragLast = null;
});
canvas.addEventListener("pointerup", () => dragLast = null);
canvas.addEventListener("pointercancel", () => dragLast = null);
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  changeZoom(Math.exp(-e.deltaY * 1e-3));
}, { passive: false });
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("pointerdown", (e) => {
  updatePointer(e);
  canvas.focus();
  if (e.button === 2) {
    e.preventDefault();
    setMode(false);
    dismantle(hovered() ?? null);
    return;
  }
  if (e.button !== 0) return;
  const t = target();
  if (!t) return;
  if (!building) {
    selected = world.at(t.x, t.y) ?? null;
    updateUI();
    if (selected) showInspector();
    return;
  }
  if (paused) {
    toast("Reanud\xE1 la simulaci\xF3n para construir.");
    return;
  }
  const existing = world.at(t.x, t.y);
  const error = tool === "belt" && existing?.type === "belt" && world.inReach(existing) ? null : world.build(t.x, t.y, tool, direction);
  if (!error && tool === "belt") {
    dragLast = t;
    canvas.setPointerCapture(e.pointerId);
  }
  toast(error ?? `${MACHINE_NAMES[tool]}: construcci\xF3n lista. Salida hacia ${DIRECTIONS[direction].label.toLowerCase()}.`);
  updateUI();
});
el5("mode").onclick = () => {
  setMode(!building);
  canvas.focus();
};
function toggleInventory() {
  const dialog = el5("inventory-dialog");
  if (dialog.open) {
    dialog.close();
    return;
  }
  if (document.querySelector("dialog[open]")) return;
  keys.clear();
  dragLast = null;
  updateUI();
  dialog.showModal();
}
el5("inventory-open").onclick = toggleInventory;
el5("inventory-close").onclick = () => el5("inventory-dialog").close();
el5("inventory-dialog").onclose = () => canvas.focus();
for (const type of TYPES) {
  const button = el5(`tool-${type}`);
  button.onclick = () => selectTool(type);
  button.dataset.cost = `Costo: ${costText(type)}`;
  button.setAttribute("aria-label", `${MACHINE_NAMES[type]}. Costo: ${costText(type)}`);
}
el5("rotate").onclick = () => {
  rotate();
  canvas.focus();
};
el5("pause").onclick = () => {
  pause();
  canvas.focus();
};
el5("save").onclick = () => {
  void persist().then((ok) => {
    if (ok) toast("Partida guardada en este navegador.");
  });
  canvas.focus();
};
el5("in").onclick = () => changeZoom(1.2);
el5("out").onclick = () => changeZoom(1 / 1.2);
el5("power-toggle").onclick = () => {
  showPower = !showPower;
  updateUI();
  canvas.focus();
};
async function toggleDemo(kind) {
  el5("demo").disabled = true;
  el5("space-demo").disabled = true;
  if (realState && demoKind === kind) {
    world = new World(realState);
    realState = null;
    demoKind = null;
    el5("save-status").textContent = "Partida local";
    toast("Volviste a tu partida.");
  } else {
    if (!realState) {
      returnToMenuAfterDemo = !hasSession;
      await persist();
      realState = structuredClone(world.state);
    }
    hasSession = true;
    world = new World(kind === "tutorial" ? tutorialState() : kind === "space" ? spaceDemoState() : industrialDemoState());
    demoKind = kind;
    if (kind === "tutorial") tutorialUI.start();
    toast(kind === "tutorial" ? "Tutorial: segu\xED los carteles y constru\xED sobre las casillas marcadas. Tu partida se conserva." : kind === "space" ? "Ejemplo espacial: las ensambladoras fabrican los componentes y la plataforma arma el cohete. Abr\xED O para lanzar cuando est\xE9 listo. Tu partida se conserva." : "Ejemplo industrial: energ\xEDa, componentes y ciencia. Tu partida se conserva.");
  }
  samples.length = 0;
  lastSample = -1;
  selected = null;
  keys.clear();
  acc = 0;
  manual = 0;
  autosave = 0;
  last = 0;
  if (paused) pause();
  setMode(false);
  camera.x = world.state.player.x;
  camera.y = world.state.player.y;
  updateUI();
  canvas.focus();
  el5("demo").disabled = false;
  el5("space-demo").disabled = false;
  if (!realState && returnToMenuAfterDemo) {
    hasSession = false;
    returnToMenuAfterDemo = false;
    menuUI.open();
  }
}
el5("demo").onclick = () => {
  menuUI.close();
  void toggleDemo("industry");
};
el5("space-demo").onclick = () => {
  menuUI.close();
  void toggleDemo("space");
};
el5("demo-return").onclick = () => {
  if (demoKind === "industry" || demoKind === "space") void toggleDemo(demoKind);
};
function machineAction(action) {
  if (paused || world.state.flight) {
    toast("Esper\xE1 el lanzamiento o reanud\xE1 la simulaci\xF3n para interactuar.");
    return;
  }
  const result = action();
  el5("machine-feedback").textContent = result ?? "Acci\xF3n realizada.";
  updateUI();
}
el5("collect").onclick = () => {
  if (selected) machineAction(() => {
    const hadPlates = selected.stock.ironPlate > 0, error = world.collect(selected);
    if (!error && hadPlates) tutorialUI.recordCollection(selected);
    return error;
  });
};
el5("recover-inputs").onclick = () => {
  if (selected) machineAction(() => world.collectInputs(selected));
};
el5("input-item").innerHTML = ITEMS.map((i) => `<option value="${i}">${ITEM_NAMES[i]}</option>`).join("");
el5("recipe-select").innerHTML = '<option value="none" disabled>Seleccion\xE1 un producto\u2026</option>' + Object.entries(RECIPES).map(([id, r]) => `<option value="${id}">${r.name}${r.tech ? " \xB7 " + TECHS[r.tech].name : ""}</option>`).join("");
el5("load-material").onclick = () => {
  if (selected) machineAction(() => world.loadMachine(selected, el5("input-item").value));
};
el5("recipe-select").onchange = () => {
  if (selected) machineAction(() => world.setRecipe(selected, el5("recipe-select").value));
};
el5("export-checkbox").onchange = () => {
  if (selected) machineAction(() => {
    if (!world.inReach(selected)) return "Acercate al cofre.";
    selected.exporting = el5("export-checkbox").checked;
    return null;
  });
};
for (const item of ["coal", "iron", "copper"]) el5(`load-${item}`).onclick = () => {
  if (selected) machineAction(() => world.loadFurnace(selected, item));
};
el5("machine-rotate").onclick = () => {
  if (selected && !paused && !world.state.flight) {
    if (world.inReach(selected)) selected.dir = (selected.dir + 1) % 4;
    else toast("Acercate para girar la m\xE1quina.");
    updateUI();
  }
};
el5("remove").onclick = () => {
  dismantle(selected);
};
el5("close-inspector").onclick = () => el5("inspector").close();
el5("inspector").onclose = () => {
  selected = null;
  inspected = null;
  updateUI();
  canvas.focus();
};
var researchDialog = el5("research-dialog");
var researchMap = setupResearchMap(() => world);
function openResearch() {
  keys.clear();
  dragLast = null;
  updateUI();
  if (!researchDialog.open) researchDialog.showModal();
}
el5("research-open").onclick = openResearch;
el5("research-close").onclick = () => researchDialog.close();
researchDialog.onclose = () => canvas.focus();
for (const id of TECH_IDS) el5(`research-${id}`).onclick = () => {
  if (paused) {
    toast("Reanud\xE1 la simulaci\xF3n para investigar.");
    return;
  }
  const error = world.startResearch(id);
  toast(error ?? `Investigaci\xF3n seleccionada: ${TECHS[id].name}. Los laboratorios consumen paquetes cient\xEDficos.`);
  updateUI();
};
var confirmation = el5("confirmation");
var pendingSeed = "";
function randomSeed2() {
  return Math.random().toString(36).slice(2, 10).toUpperCase().padEnd(8, "0");
}
el5("random-seed").onclick = () => {
  el5("seed").value = randomSeed2();
};
function requestNewGame(seed) {
  const chosen = seed.trim();
  pendingSeed = chosen.startsWith("m4:") ? chosen : `m4:${chosen}`;
  if (!chosen || pendingSeed.length > 48) return;
  keys.clear();
  el5("new-game-error").textContent = "";
  if (storedSave || hasSession) confirmation.showModal();
  else void startFreshGame();
}
el5("new-world").onsubmit = (e) => {
  e.preventDefault();
  if (realState) {
    toast("Volv\xE9 a tu partida antes de crear un mundo nuevo.");
    return;
  }
  requestNewGame(el5("seed").value);
};
el5("cancel-new").onclick = () => confirmation.close();
var startingNew = false;
async function startFreshGame() {
  if (startingNew) return;
  startingNew = true;
  el5("confirm-new").disabled = true;
  const fresh = createState(pendingSeed);
  try {
    await save(fresh);
    sessionOnly = false;
    storedSave = structuredClone(fresh);
    activateGame(fresh);
    confirmation.close();
    menuUI.close();
    toast("Nueva expedici\xF3n. Acercate a tu nave y manten\xE9 E para recuperar materiales, o abr\xED el tutorial.");
  } catch {
    if (location.protocol === "file:") {
      sessionOnly = true;
      activateGame(fresh);
      confirmation.close();
      menuUI.close();
      el5("save-status").textContent = "Sesi\xF3n temporal \xB7 sin guardado";
      toast("Pod\xE9s jugar. Este navegador no permite guardar archivos locales; para conservar la partida us\xE1 la versi\xF3n de GitHub Pages.");
    } else {
      el5("new-game-error").textContent = "No se pudo guardar la nueva partida. El guardado anterior se conserva.";
      if (!confirmation.open) confirmation.showModal();
    }
  } finally {
    startingNew = false;
    el5("confirm-new").disabled = false;
  }
}
confirmation.oncancel = (e) => {
  if (startingNew) e.preventDefault();
};
el5("confirm-new").onclick = () => void startFreshGame();
function resetPlanetView() {
  selected = null;
  keys.clear();
  samples.length = 0;
  lastSample = -1;
  manual = 0;
  acc = 0;
  dragLast = null;
  camera.x = world.state.player.x;
  camera.y = world.state.player.y;
  setMode(false);
}
var spaceUI = setupSpaceUI({ world: () => world, selected: () => selected, paused: () => paused, notify: toast, opened: () => {
  keys.clear();
  dragLast = null;
}, focus: () => canvas.focus(), mutated: (travel) => {
  if (travel) resetPlanetView();
  updateUI();
  void persist();
} });
var tutorialUI = setupTutorialUI({
  active: () => demoKind === "tutorial",
  world: () => world,
  paused: () => paused,
  prepare: (type, x, y, build) => {
    if (type === "wreck") {
      setMode(false);
      canvas.focus();
    } else if (build) {
      direction = 0;
      selectTool(type);
    } else {
      selected = world.at(x, y) ?? null;
      setMode(false);
      showInspector();
    }
  },
  exit: () => void toggleDemo("tutorial"),
  restart: () => {
    world = new World(tutorialState());
    tutorialUI.start();
    if (paused) pause();
    resetPlanetView();
    autosave = 0;
    last = 0;
    updateUI();
    canvas.focus();
  },
  research: openResearch
});
function activateGame(state) {
  world = new World(state);
  hasSession = true;
  realState = null;
  demoKind = null;
  returnToMenuAfterDemo = false;
  el5("seed").value = randomSeed2();
  autosave = 0;
  last = 0;
  if (paused) pause();
  resetPlanetView();
  updateUI();
}
var menuUI = setupMainMenu({
  saved: () => storedSave,
  canResume: () => hasSession,
  newGame: requestNewGame,
  load: async () => {
    const restored = await load();
    if (!restored) {
      storedSave = null;
      return "No se encontr\xF3 una partida v\xE1lida. Pod\xE9s comenzar una nueva.";
    }
    storedSave = structuredClone(restored);
    activateGame(restored);
    toast("Partida cargada. \xA1Bienvenido de vuelta!");
    return null;
  },
  tutorial: () => {
    if (demoKind !== "tutorial") void toggleDemo("tutorial");
  },
  options: () => ({ zoom, coverage: showPower, motion: document.documentElement.classList.contains("reduce-motion") }),
  applyOptions: (options) => {
    zoom = options.zoom;
    showPower = options.coverage;
    document.documentElement.classList.toggle("reduce-motion", options.motion);
    limitZoom();
    updateUI();
  },
  closed: () => {
    keys.clear();
    last = 0;
    acc = 0;
    mouse = null;
    canvas.focus();
  }
});
el5("menu-open").onclick = () => {
  keys.clear();
  dragLast = null;
  mouse = null;
  menuUI.open();
  void persist().then(() => menuUI.update());
};
function stockText(stock2) {
  return ITEMS.filter((i) => stock2[i] > 0).map((i) => `<span class="item-stack">${itemIcon(i)}<span>${ITEM_NAMES[i]}: <b>${stock2[i]}</b></span></span>`).join("") || "Vac\xEDo";
}
function updateUI() {
  const s = world.state;
  const power = world.power();
  el5("inventory").innerHTML = ITEMS.filter((i) => s.inventory[i] > 0 || ["iron", "copper", "coal", "stone"].includes(i)).map((i) => `<div class="resource">${itemIcon(i)}<span>${ITEM_NAMES[i]}</span><strong>${s.inventory[i].toLocaleString("es-AR")}</strong></div>`).join("");
  el5("machines").textContent = String(s.machines.length);
  const wreck = world.wreck();
  el5("wreck-panel").hidden = !wreck;
  if (wreck) el5("wreck-summary").textContent = `Restos en (${wreck.x}, ${wreck.y}) \xB7 ${(s.kitClaimed ? 8 : wreck.starter) + (s.industrialKit ? 12 : wreck.industrial)} / 20 secciones recuperadas.`;
  el5("demo").textContent = demoKind === "industry" ? "\u2190 Volver a mi partida" : "\u25B7 Ver industria de ejemplo";
  el5("space-demo").textContent = demoKind === "space" ? "\u2190 Volver a mi partida" : "\u219F Ver lanzamiento de ejemplo";
  el5("demo-banner").hidden = !realState || demoKind === "tutorial";
  if (realState) el5("save-status").textContent = "Demostraci\xF3n \xB7 no se guarda";
  el5("goals").innerHTML = [
    [world.hasTech("astronautics"), "Investigar Astron\xE1utica"],
    [s.production.rocketFrame > 0 && s.production.rocketEngine > 0, "Fabricar componentes espaciales"],
    [s.launches >= 1, "Lanzar el primer cohete"],
    [s.highestPlanet >= 2, "Descubrir titanio y cristales"],
    [s.launches >= 3, `Completar la campa\xF1a \xB7 ${Math.min(3, s.launches)}/3`],
    [s.highestPlanet >= 4, `Explorar el espacio profundo \xB7 ${Math.max(0, s.highestPlanet - 2)} sectores`]
  ].map(([done, title]) => `<div class="goal ${done ? "done" : ""}"><span>${done ? "\u2713" : "\u25CB"}</span> ${title}</div>`).join("");
  el5("coords").textContent = `X ${s.player.x.toFixed(1)} / Y ${s.player.y.toFixed(1)}`;
  el5("zoom").textContent = Math.round(zoom * 100) + "%";
  for (const type of TYPES) {
    el5(`tool-${type}`).classList.toggle("selected", building && tool === type);
    el5(`tool-${type}`).classList.toggle("locked", type === "splitter" && !world.hasTech("logistics") || type === "launchpad" && !world.hasTech("astronautics"));
  }
  el5("power-output").textContent = `${power.generated.toFixed(0)} / ${power.capacity} kW`;
  const disconnected = [...power.ratios.entries()].filter(([m2, r]) => r === 0 && world.canWork(m2)).length;
  el5("power-status").textContent = disconnected ? `${disconnected} sin suministro` : [...power.ratios.values()].some((r) => r > 0 && r < 1) ? "Red sobrecargada" : power.capacity ? "Red estable" : "Sin generaci\xF3n";
  el5("power-meter").style.width = `${power.capacity ? Math.min(100, power.generated / power.capacity * 100) : 0}%`;
  el5("power-detail").textContent = `Demanda activa ${power.demand} kW \xB7 capacidad ${power.capacity} kW`;
  el5("power-toggle").classList.toggle("active", showPower);
  el5("power-toggle").textContent = showPower ? "P \xB7 Ocultar cobertura" : "P \xB7 Ver cobertura";
  el5("active-research").textContent = s.research ? `${TECHS[s.research].name} \xB7 ${s.techProgress[s.research]} / ${TECHS[s.research].cost} paquetes` : s.unlocked.length === TECH_IDS.length ? "\u2713 Programa cient\xEDfico completo" : "Eleg\xED una tecnolog\xEDa para investigar";
  for (const id of TECH_IDS) {
    const done = world.hasTech(id), ready = TECHS[id].requires.every((t2) => world.hasTech(t2)), active = s.research === id;
    el5(`tech-${id}`).classList.toggle("complete", done);
    el5(`tech-${id}`).classList.toggle("researching", active);
    el5(`tech-progress-${id}`).textContent = `${s.techProgress[id]} / ${TECHS[id].cost} paquetes`;
    el5(`tech-meter-${id}`).style.width = `${s.techProgress[id] / TECHS[id].cost * 100}%`;
    el5(`research-${id}`).disabled = done || !ready || active;
    el5(`research-${id}`).textContent = done ? "\u2713 Completada" : active ? "Investigando" : !ready ? "Bloqueada" : "Investigar";
  }
  researchMap.update();
  const base = samples[0], duration = base ? s.time - base.time : 0;
  el5("production-rates").innerHTML = ["ironPlate", "circuit", "science", "steel", "rocketFrame", "rocketEngine", "rocketFuel"].map((i) => {
    const rate = duration > 0 ? (s.production[i] - (base?.counts[i] ?? 0)) / duration * 60 : 0;
    return `<div class="rate-row"><span class="item-label">${itemIcon(i)}${ITEM_NAMES[i]}</span><b>${rate.toFixed(1)}/min</b><i style="width:${Math.min(100, rate / 30 * 100)}%;background:${ITEM_COLORS[i]}"></i></div>`;
  }).join("");
  el5("direction").textContent = DIRECTIONS[direction].label;
  const t = target(), tile2 = t && world.tile(t.x, t.y), m = hovered();
  const hint = el5("build-hint");
  hint.hidden = !building || !mouse || !t || !!m;
  if (building && mouse && t) {
    const reason = paused ? "Reanud\xE1 la simulaci\xF3n para construir." : world.placement(t.x, t.y, tool);
    const kitHint = reason?.startsWith("Faltan materiales:") && world.wreck() ? " Recuper\xE1 materiales de la nave manteniendo E cerca de ella." : "";
    hint.textContent = `${tile2?.resource ? "Mena: " + ITEM_NAMES[tile2.resource] + " \xB7 " : ""}${MACHINE_NAMES[tool]} \xB7 ${reason ?? "Clic para construir"}${kitHint}`;
    hint.classList.toggle("blocked", !!reason);
    const hintWidth = Math.min(310, w - 24), hintHeight = hint.offsetHeight;
    hint.style.maxWidth = `${hintWidth}px`;
    hint.style.left = `${Math.max(12, Math.min(w - hintWidth - 12, mouse.x + 18))}px`;
    hint.style.top = `${Math.max(12, Math.min(h - hintHeight - 12, mouse.y + 24))}px`;
  }
  el5("hover").textContent = t && world.wreckAt(t.x, t.y) ? "Nave accidentada \xB7 acercate y manten\xE9 E para recuperar materiales" : m ? `${MACHINE_NAMES[m.type]} \xB7 ${world.status(m, power)} \xB7 ${DIRECTIONS[m.dir].label}` : t && tile2?.resource ? `${ITEM_NAMES[tile2.resource]} \xB7 ${tile2.amount} restantes \xB7 (${t.x}, ${t.y})` : "Explor\xE1 los yacimientos \xB7 clic en una m\xE1quina para inspeccionar";
  updateOreHint();
  if (!selected && el5("inspector").open) el5("inspector").close();
  if (selected) {
    el5("machine-title").textContent = MACHINE_NAMES[selected.type];
    el5("machine-status").textContent = world.status(selected, power) + (world.inReach(selected) ? "" : " \xB7 fuera de alcance");
    el5("machine-diagnostics").innerHTML = machineDiagnostics(world, selected, power).map((d) => `<p class="diagnostic ${d.warning ? "warning" : "ok"}"><b>${d.kind}</b> \xB7 ${d.message}</p>`).join("");
    el5("remove").textContent = `Desmontar ${MACHINE_NAMES[selected.type].toLowerCase()}`;
    el5("remove").title = "Tambi\xE9n pod\xE9s hacer clic derecho sobre la m\xE1quina en el mapa. Devuelve materiales y contenido; el combustible encendido se pierde.";
    el5("machine-location").textContent = `(${selected.x}, ${selected.y}) \xB7 salida ${DIRECTIONS[selected.dir].label}`;
    el5("machine-stock").innerHTML = stockText(selected.stock);
    el5("machine-output").innerHTML = stockText(selected.output);
    el5("machine-production").textContent = selected.type === "inserter" ? `${selected.produced} unidades transferidas \xB7 toma detr\xE1s y entrega delante \xB7 2 kW \xB7 ciclo ${Math.round(selected.progress / 0.8 * 100)} %` : selected.type === "furnace" ? `${selected.produced} placas \xB7 combustible ${selected.fuel.toFixed(1)} s \xB7 proceso ${Math.round(selected.progress / 2 * 100)} %` : selected.type === "miner" ? `${selected.produced} extra\xEDdos \xB7 reserva ${world.tile(selected.x, selected.y).amount}` : selected.type === "generator" ? `60 kW base \xB7 combustible ${selected.fuel.toFixed(1)} s` : selected.type === "assembler" ? selected.recipe === "none" ? "Esperando selecci\xF3n de receta" : `${selected.produced} ciclos \xB7 proceso ${Math.round(selected.progress / RECIPES[selected.recipe].seconds * 100)} %` : selected.type === "lab" ? `${selected.produced} paquetes procesados \xB7 ${Math.round(selected.progress / 2 * 100)} %` : `${total(selected.stock)} unidades almacenadas`;
    el5("furnace-load").hidden = selected.type !== "furnace";
    el5("collect").textContent = selected.type === "chest" ? "Recoger del cofre" : "Recoger salida";
    el5("platform-open").hidden = selected.type !== "launchpad";
    el5("assembler-recipe").hidden = selected.type !== "assembler";
    if (document.activeElement !== el5("recipe-select")) el5("recipe-select").value = selected.recipe;
    for (const option of Array.from(el5("recipe-select").options)) {
      option.disabled = option.value === "none" || !world.recipeUnlocked(option.value);
    }
    const recipe = selected.recipe === "none" ? null : RECIPES[selected.recipe];
    el5("recipe-description").innerHTML = recipe ? Object.entries(recipe.input).map(([i, n]) => `<span class="item-label">${itemIcon(i)}${n} ${ITEM_NAMES[i]}</span>`).join(" + ") + " \u2192 " + Object.entries(recipe.output).map(([i, n]) => `<span class="item-label">${itemIcon(i)}${n} ${ITEM_NAMES[i]}</span>`).join(" + ") + ` \xB7 ${recipe.seconds} s` : "Eleg\xED qu\xE9 producto quer\xE9s fabricar.";
    el5("chest-export").hidden = selected.type !== "chest";
    el5("export-checkbox").checked = selected.exporting;
    el5("machine-load").hidden = !["generator", "assembler", "lab", "chest", "launchpad"].includes(selected.type);
    const material = el5("input-item");
    for (const option of Array.from(material.options)) option.disabled = world.inputLimit(selected, option.value) === 0;
    if (inspected !== selected || world.inputLimit(selected, material.value) === 0) {
      material.value = ITEMS.find((i) => world.inputLimit(selected, i) > 0) ?? "iron";
      inspected = selected;
    }
    el5("load-material").disabled = !ITEMS.some((i) => world.inputLimit(selected, i) > 0);
    el5("recover-inputs").hidden = ["pole", "miner", "inserter"].includes(selected.type);
  }
  spaceUI.update();
  tutorialUI.update();
}
function frame(ms) {
  const dt = last ? Math.min((ms - last) / 1e3, 0.1) : 0;
  last = ms;
  if (hasSession && !menuUI.isOpen() && !paused && !document.hidden && !confirmation.open) {
    acc += dt;
    while (acc >= 0.05) {
      const oldPlanet = world.state.planet;
      if (!world.state.flight) movePlayer(world, Number(keys.has("d") || keys.has("arrowright")) - Number(keys.has("a") || keys.has("arrowleft")), Number(keys.has("s") || keys.has("arrowdown")) - Number(keys.has("w") || keys.has("arrowup")), 0.05);
      world.tick(0.05);
      if (world.state.planet !== oldPlanet) {
        resetPlanetView();
        toast(`Llegaste a ${world.planet().name}. ${world.planet().description} O abre tus colonias y el siguiente objetivo.`);
        void persist();
        break;
      }
      if (world.state.time - lastSample >= 1) {
        samples.push({ time: world.state.time, counts: { ...world.state.production } });
        lastSample = world.state.time;
        while (samples.length > 1 && samples[1].time < world.state.time - 60) samples.shift();
      }
      if (keys.has("e") && !building && !world.state.flight) {
        manual += 0.05;
        if (manual >= 0.25) {
          manual = 0;
          const t = world.nearest();
          if (world.canSalvage()) {
            const drop = world.salvageHit();
            if (drop) toast("Recuperaste " + Object.entries(drop).map(([i, n]) => `${n} ${ITEM_NAMES[i]}`).join(" \xB7 ") + (world.wreck() ? "" : " \xB7 Nave desarmada. \xA1Constru\xED tu f\xE1brica!"));
          } else if (t) world.extract(t.x, t.y);
          else toast("Acercate a la nave o a un yacimiento sin m\xE1quinas para extraer.");
        }
      } else manual = 0;
      acc -= 0.05;
    }
    autosave += dt;
    if (autosave >= 10) {
      autosave = 0;
      void persist();
    }
  }
  const unit = 32 * zoom, p = world.state.player;
  camera.x = Math.max(w / 2 / unit, Math.min(SIZE - w / 2 / unit, p.x));
  camera.y = Math.max(h / 2 / unit, Math.min(SIZE - h / 2 / unit, p.y));
  const view = { w, h, dpr, zoom, camera, building, tool, direction, target: target(), selected, walking: !paused && ["w", "a", "s", "d", "arrowup", "arrowleft", "arrowdown", "arrowright"].some((k) => keys.has(k)), mining: keys.has("e") && !paused && !building, showPower };
  render(ctx, world, view);
  tutorialUI.draw(view);
  uiTime += dt;
  if (uiTime > 0.12) {
    updateUI();
    uiTime = 0;
  }
  requestAnimationFrame(frame);
}
resize();
updateUI();
menuUI.open();
requestAnimationFrame(frame);

})().catch(error => {
  console.error(error);
  document.body.textContent = 'No se pudo iniciar el juego. Abrí este archivo en una versión reciente de Chrome, Edge o Firefox.';
});
