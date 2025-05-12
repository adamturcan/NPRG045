import json

import gradio as gr
import pandas as pd
import requests
from lingua import LanguageDetectorBuilder

langdetector = LanguageDetectorBuilder.from_all_languages().with_preloaded_language_models().build()

LANG_2_FLORES = {
    "Czech": "ces_Latn",
    "Danish": "dan_Latn",
    "Dutch": "nld_Latn",
    "English": "eng_Latn",
    "German": "deu_Latn",
    "Hebrew": "heb_Hebr",
    "Hungarian": "hun_Latn",
    "Polish": "pol_Latn",
    "Ukrainian": "ukr_Cyrl",
}

SEMTAG = "https://semtag-api.dev.memorise.sdu.dk/semtag"
NER = "https://semtag-api.dev.memorise.sdu.dk/ner"
MT = "https://quest.ms.mff.cuni.cz/dimbu"


def classify(text: str) -> dict[str, list[dict]]:
    response = requests.post(f"{SEMTAG}/classify", json={"text": text})
    return json.loads(response.text)


def ner(text: str) -> dict[str, list[dict]]:
    response = requests.post(f"{NER}/ner", json={"text": text})
    return json.loads(response.text)


def get_supported_languages() -> dict[str, list[str]]:
    return json.loads(requests.get(f"{MT}/supported_languages").text)


def translate(text: str, tgt_lang: str) -> dict[str, list[dict]]:
    all_langs = get_supported_languages()["supported_languages"]
    lang = langdetector.detect_language_of(text)
    if lang is None:
        return {"text": ""}
    lang = langdetector.detect_language_of(text).iso_code_639_3.name.lower()
    src_lang = [l for l in all_langs if l.startswith(lang)][0]
    tgt_lang = LANG_2_FLORES[tgt_lang]
    response = requests.post(f"{MT}/translate", json={"text": text, "src_lang": src_lang, "tgt_lang": tgt_lang})
    return json.loads(response.text)


def request(fn, **kwargs):
    response = fn(**kwargs)
    if "text" in response.keys():
        return response["text"]
    if "detail" in response.keys():
        return response["detail"]
    results = pd.DataFrame.from_records(response["results"])
    return results.drop(columns=["score"]) if "score" in results.columns else results


def upload_file(file):
    with open(file, encoding="utf8") as handle:
        text = handle.read()
    return text


with gr.Blocks(title="MEMORISE NLP API") as demo:
    gr.Markdown("# MEMORISE NLP API")
    with gr.Row():
        with gr.Column(scale=4):
            text = gr.Textbox(label="Input text")
        with gr.Column(scale=1):
            upload_button = gr.UploadButton(label="Upload text file", file_types=[".txt"])
    with gr.Row():
        with gr.Column():
            gr.Markdown("## Information Extraction")
            with gr.Row():
                classify_button = gr.Button("Classify subject terms")
                ner_button = gr.Button("Extract named entities")
            table_output = gr.DataFrame(
                label="Information extraction output",
                row_count=(1, "dynamic"),
                col_count=(0, "dynamic"),
            )
        with gr.Column():
            gr.Markdown("## Machine Translation")
            with gr.Row():
                tgt_lang = gr.Dropdown(
                    label="Target language",
                    choices=list(LANG_2_FLORES),
                )
                translate_button = gr.Button("Translate")
            translate_output = gr.Textbox(label="Translation output")

    upload_button.upload(upload_file, inputs=upload_button, outputs=text)
    classify_button.click(fn=lambda t: request(classify, text=t), inputs=text, outputs=table_output)
    ner_button.click(fn=lambda t: request(ner, text=t), inputs=text, outputs=table_output)
    translate_button.click(
        fn=lambda t, l: request(translate, text=t, tgt_lang=l), inputs=[text, tgt_lang], outputs=translate_output
    )

demo.launch(share=False)