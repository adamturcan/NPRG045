export async function classify(text: string) {
  const res = await fetch(
    "https://semtag-api.dev.memorise.sdu.dk/semtag/classify",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }
  );
  if (!res.ok) throw new Error(`Classify failed: ${res.status}`);
  return res.json();
}

export async function ner(text: string) {
  const res = await fetch("https://semtag-api.dev.memorise.sdu.dk/ner/ner", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`NER failed: ${res.status}`);
  return res.json();
}
