/**
 * Moteur d'explication, couche 2 (optionnelle) : Claude reformule les faits
 * vérifiés de la couche 1 en une explication naturelle. Claude ne reçoit que
 * ces faits : il n'a pas à calculer de coups (un LLM seul invente des coups).
 *
 * La clé API reste dans le navigateur (localStorage) et part directement chez Anthropic.
 */
// Le SDK n'est chargé qu'au premier clic sur « Expliquer avec Claude » (il pèse lourd).
const loadSdk = () => import('@anthropic-ai/sdk').then((m) => m.default);

const KEY_STORAGE = 'anthropic-api-key';
export const MODEL = 'claude-opus-5-5';

export function getApiKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function setApiKey(key: string) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key);
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* stockage indisponible : la clé ne sera pas retenue */
  }
}

const SYSTEM = `Tu es un entraîneur d'échecs bienveillant qui commente la partie d'un joueur amateur, en français.
On te donne le coup joué, sa catégorie et une liste de faits vérifiés par le moteur Stockfish.
Écris 2 à 4 phrases simples qui expliquent le coup au joueur, en le tutoyant.
Règles strictes :
- N'utilise que les faits fournis. N'invente aucun coup, aucune variante, aucune menace.
- Cite les coups exactement comme ils sont écrits dans les faits (notation anglaise : N = cavalier, B = fou, R = tour, Q = dame, K = roi).
- Pas de titre, pas de liste, pas de markdown : juste un court paragraphe.`;

const cache = new Map<string, string>();

/** Reformule les faits ; lève une erreur lisible en cas de problème (clé invalide…). */
export async function rephrase(moveSan: string, category: string, facts: string[]): Promise<string> {
  const prompt = `Coup joué : ${moveSan}\nCatégorie : ${category}\nFaits vérifiés :\n${facts.map((f) => `- ${f}`).join('\n')}`;
  const cached = cache.get(prompt);
  if (cached) return cached;

  const Anthropic = await loadSdk();
  const client = new Anthropic({ apiKey: getApiKey(), dangerouslyAllowBrowser: true });
  let response;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 1024,
      output_config: { effort: 'low' },
      // Si le modèle refuse, l'API relance la demande sur un modèle de secours.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('clé API invalide');
    if (e instanceof Anthropic.RateLimitError) throw new Error('trop de demandes, réessaie dans un instant');
    if (e instanceof Anthropic.APIError) throw new Error(`erreur de l'API (${e.status})`);
    throw new Error('connexion impossible');
  }
  if (response.stop_reason === 'refusal') throw new Error('Claude a refusé de répondre');
  const text = response.content
    .flatMap((b) => (b.type === 'text' ? [b.text] : []))
    .join('')
    .trim();
  cache.set(prompt, text);
  return text;
}
