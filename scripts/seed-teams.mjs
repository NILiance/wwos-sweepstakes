// Seed draw pools: pro teams (city/abbrev only — no league nicknames per
// SCOPE §2.4), top college programs, and golfers. Admin-editable later;
// college/golf lists are starting points until the data provider lands.
// Usage: node scripts/seed-teams.mjs
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z]/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const H = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "resolution=merge-duplicates",
};

const T = {
  nfl: "ARI Arizona|ATL Atlanta|BAL Baltimore|BUF Buffalo|CAR Carolina|CHI Chicago|CIN Cincinnati|CLE Cleveland|DAL Dallas|DEN Denver|DET Detroit|GB Green Bay|HOU Houston|IND Indianapolis|JAX Jacksonville|KC Kansas City|LV Las Vegas|LAC LA Chargers|LAR LA Rams|MIA Miami|MIN Minnesota|NE New England|NO New Orleans|NYG NY Giants|NYJ NY Jets|PHI Philadelphia|PIT Pittsburgh|SEA Seattle|SF San Francisco|TB Tampa Bay|TEN Tennessee|WAS Washington",
  nba: "ATL Atlanta|BOS Boston|BRK Brooklyn|CHA Charlotte|CHI Chicago|CLE Cleveland|DAL Dallas|DEN Denver|DET Detroit|GS Golden State|HOU Houston|IND Indiana|LAC LA Clippers|LAL LA Lakers|MEM Memphis|MIA Miami|MIL Milwaukee|MIN Minnesota|NO New Orleans|NYK New York|OKC Oklahoma City|ORL Orlando|PHI Philadelphia|PHO Phoenix|POR Portland|SAC Sacramento|SA San Antonio|TOR Toronto|UT Utah|WAS Washington",
  wnba: "ATL Atlanta|CHI Chicago|CON Connecticut|DAL Dallas|GS Golden State|IND Indiana|LV Las Vegas|LA Los Angeles|MIN Minnesota|NY New York|PHO Phoenix|POR Portland|SEA Seattle|TOR Toronto|WAS Washington",
  nhl: "ANA Anaheim|BOS Boston|BUF Buffalo|CGY Calgary|CAR Carolina|CHI Chicago|COL Colorado|CBJ Columbus|DAL Dallas|DET Detroit|EDM Edmonton|FLA Florida|LAK Los Angeles|MIN Minnesota|MTL Montreal|NSH Nashville|NJ New Jersey|NYI NY Islanders|NYR NY Rangers|OTT Ottawa|PHI Philadelphia|PIT Pittsburgh|SJ San Jose|SEA Seattle|STL St. Louis|TB Tampa Bay|TOR Toronto|UTA Utah|VAN Vancouver|VGK Vegas|WSH Washington|WPG Winnipeg",
  mlb: "ARI Arizona|ATH Athletics|ATL Atlanta|BAL Baltimore|BOS Boston|CHC Chi Cubs|CHW Chi White Sox|CIN Cincinnati|CLE Cleveland|COL Colorado|DET Detroit|HOU Houston|KC Kansas City|LAA LA Angels|LAD LA Dodgers|MIA Miami|MIL Milwaukee|MIN Minnesota|NYM NY Mets|NYY NY Yankees|PHI Philadelphia|PIT Pittsburgh|SD San Diego|SF San Francisco|SEA Seattle|STL St. Louis|TB Tampa Bay|TEX Texas|TOR Toronto|WAS Washington",
  cfb: "ALA Alabama|ARK Arkansas|ARIZ Arizona|ASU Arizona St|AUB Auburn|BAYL Baylor|BOISE Boise St|BYU BYU|CAL California|CLEM Clemson|COL Colorado|DUKE Duke|FLA Florida|FSU Florida St|GA Georgia|GT Georgia Tech|ILL Illinois|IND Indiana|IOWA Iowa|IAST Iowa St|KANS Kansas|KST Kansas St|UK Kentucky|LSU LSU|LOU Louisville|MD Maryland|MEM Memphis|MIA-FL Miami FL|MICH Michigan|MIST Michigan St|MINN Minnesota|MIZZ Missouri|NEB Nebraska|ND Notre Dame|UNC North Carolina|NCST NC State|OHST Ohio St|OKLA Oklahoma|OKST Oklahoma St|OLEM Ole Miss|ORE Oregon|PSU Penn St|PITT Pittsburgh|RUTG Rutgers|SMU SMU|SCAR South Carolina|USC USC|SYR Syracuse|TENN Tennessee|TX Texas|TAMU Texas A&M|TTU Texas Tech|TCU TCU|TULN Tulane|UCF UCF|UCLA UCLA|UTAH Utah|VAN Vanderbilt|VT Virginia Tech|WASH Washington|WISC Wisconsin|WVU West Virginia",
  cbb: "ALA Alabama|ARI Arizona|ARK Arkansas|AUB Auburn|BAYL Baylor|BYU BYU|CIN Cincinnati|CLEM Clemson|CONN UConn|CREI Creighton|DAY Dayton|DUKE Duke|FLA Florida|GONZ Gonzaga|HOU Houston|ILL Illinois|IND Indiana|IAST Iowa St|KANS Kansas|KST Kansas St|UK Kentucky|LOU Louisville|MARQ Marquette|MD Maryland|MEM Memphis|MIA-FL Miami FL|MICH Michigan|MIST Michigan St|MINN Minnesota|MIZZ Missouri|UNC North Carolina|NCST NC State|NW Northwestern|ND Notre Dame|OHST Ohio St|OKLA Oklahoma|OLEM Ole Miss|ORE Oregon|PITT Pittsburgh|PROV Providence|PURD Purdue|RUTG Rutgers|SDST San Diego St|SMC Saint Mary's|SETON Seton Hall|SCAR South Carolina|STJ St. John's|SYR Syracuse|TENN Tennessee|TX Texas|TAMU Texas A&M|TTU Texas Tech|TCU TCU|UCLA UCLA|USC USC|UTAH Utah|VILL Villanova|VA Virginia|WAKE Wake Forest|WISC Wisconsin|XAV Xavier",
  pga: "S Scheffler|R McIlroy|X Schauffele|C Morikawa|L Aberg|W Clark|V Hovland|P Cantlay|J Thomas|J Spieth|M Homa|S Burns|T Finau|R Henley|S Im|B Harman|J Day|T Fleetwood|S Lowry|C Conners|H Matsuyama|S Straka|A Bhatia|R MacIntyre|C Young|T Pendrith|D Thompson|JT Poston|K Bradley|S Theegala|N Dunlap|A Rai|T Detry|M Fitzpatrick|T Kim|J Niemann fallback-pga|M Pavon|C Kirk|B Hun An|T Hoge|A Hadwin|C Bezuidenhout|S Jaeger|W Zalatoris|D Burmester",
  liv: "J Rahm|B Koepka|B DeChambeau|C Smith|J Niemann|T Hatton|D Johnson|P Reed|S Garcia|L Oosthuizen|A Ancer|T Gooch|C Ortiz|P Casey",
};

let total = 0;
for (const [sport, list] of Object.entries(T)) {
  const isGolf = sport === "pga" || sport === "liv";
  const rows = list.split("|").map((item) => {
    if (isGolf) {
      const name = item.replace(" fallback-pga", "").trim();
      return { sport_id: sport, name, abbrev: name, market: null };
    }
    const sp = item.indexOf(" ");
    return {
      sport_id: sport,
      abbrev: item.slice(0, sp),
      name: item.slice(sp + 1),
      market: item.slice(sp + 1),
    };
  });
  const r = await fetch(`${URL_}/rest/v1/teams?on_conflict=sport_id,abbrev`, {
    method: "POST",
    headers: H,
    body: JSON.stringify(rows),
  });
  if (!r.ok) {
    console.log(sport, "ERROR", await r.text());
    process.exit(1);
  }
  total += rows.length;
  console.log(sport, rows.length);
}
console.log("total teams:", total);
