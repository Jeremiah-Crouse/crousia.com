/**
 * Service to handle ProtoEve token generation with Quantum Seeding
 */
import { $getRoot, $createTextNode, $createParagraphNode, $getSelection, $isRangeSelection } from 'lexical';

const QRNG_URL = (count) => `https://lfdr.de/qrng_api/qrng?length=${4 * count}&format=HEX`;
const OLLAMA_URL = 'http://127.0.0.1:11434/api/generate';

export const protoEveGenerate = async (editor, awareness) => {
  let isDone = false;

  // Extract plain text for the model prompt
  let currentPrompt = editor.getEditorState().read(() => $getRoot().getTextContent());
  console.log("Initial Prompt extracted:", currentPrompt);

  // Set cursor label to "Proto Eve" in YJS awareness
  const originalUser = awareness.getLocalState()?.user;
  awareness.setLocalStateField('user', {
    ...originalUser,
    name: 'Proto Eve',
    color: '#FFD700', // Gold color for royalty
  });

  try {
    while (!isDone) {
      // 1. Fetch 800 bytes (enough for 200 tokens/seeds)
      // Convert hex string to array of uint32 seeds
      // Each seed is 8 hex chars (4 bytes)
      const seeds = [];
      const NUM_SEEDS_TO_FETCH = 200;

      try {
        const qrngResponse = await fetch(QRNG_URL(NUM_SEEDS_TO_FETCH));
        if (!qrngResponse.ok) throw new Error(`QRNG API returned status ${qrngResponse.status}`);
        const { qrn } = await qrngResponse.json();
        
        for (let i = 0; i < qrn.length; i += 8) {
          seeds.push(parseInt(qrn.slice(i, i + 8), 16) >>> 0);
        }
        console.log(`Fetched ${seeds.length} quantum seeds.`);
      } catch (qrngError) {
        console.warn(`Failed to fetch quantum randomness (CORS or network issue): ${qrngError.message}. Falling back to pseudorandom numbers.`);
        // Fallback to pseudorandom numbers if QRNG fails
        for (let i = 0; i < NUM_SEEDS_TO_FETCH; i++) {
          seeds.push(Math.floor(Math.random() * 0xFFFFFFFF) >>> 0); // Generate a 32-bit unsigned integer
        }
      }
      // 2. Generate tokens one by one using the seeds
      for (const seed of seeds) {
        console.log(`Generating token with seed: ${seed}...`);
        
        const response = await fetch(OLLAMA_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'ProtoEve',
            prompt: currentPrompt,
            stream: false,
            options: {
              seed: seed,
              num_predict: 1, // Pull exactly 1 token
            }
          }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Ollama Error:", errText);
            throw new Error(`Ollama failed: ${response.status}`);
        }
        
        const result = await response.json();
        const newToken = result.response;
        
        if (!newToken) continue;
        console.log("Proto Eve Token:", newToken);

        editor.update(() => {
          const root = $getRoot();
          let lastChild = root.getLastChild();
          
          // Ensure we have a paragraph to write into
          if (!lastChild || lastChild.getType() !== 'paragraph') {
            lastChild = $createParagraphNode();
            root.append(lastChild);
          }

          const textNode = $createTextNode(newToken);
          // Force the gold color style for Proto Eve
          textNode.setStyle('color: #FFD700');
          lastChild.append(textNode);
          
          // Move cursor to the end of the new token and scroll into view
          textNode.select();
        }, { tag: 'proto-eve' });
        
        // Update context for next token
        currentPrompt = editor.getEditorState().read(() => $getRoot().getTextContent());

        // 4. Check for end signal
        if (result.done) {
          isDone = true;
          break;
        }
      }
      
      // If 200 seeds are exhausted and not done, the while loop continues 
      // and fetches another 800 bytes.
    }
  } catch (error) {
    console.error("Proto Eve Error:", error);
  } finally {
    // Restore original cursor label
    awareness.setLocalStateField('user', originalUser);
  }
};