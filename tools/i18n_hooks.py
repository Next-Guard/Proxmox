"""Hook MkDocs per il sito bilingue (mkdocs-static-i18n + Material).

mkdocs-static-i18n costruisce le lingue una dopo l'altra nella stessa cartella, quindi:
- ogni build scrive 404.html nella radice e vincerebbe l'ultima lingua (l'italiano);
- l'indice di ricerca è unico e una ricerca mostrerebbe le pagine di tutte le lingue.

Questo hook:
1. lascia nella radice la 404 della lingua predefinita (inglese) e scrive quella delle
   altre lingue nella loro cartella (it/404.html);
2. divide l'indice di ricerca per lingua (search/search_index.json per l'inglese,
   it/search/search_index.json per l'italiano) e fa usare a ogni pagina quello della
   sua lingua: la "base" di Material, da cui si calcolano l'indice e i link dei
   risultati, punta alla radice della lingua.
"""
import json
import os
import posixpath
import re
import shutil

from mkdocs.plugins import event_priority

# Python ha appena scritto il bytecode di questo hook: niente __pycache__ nel repository.
shutil.rmtree(os.path.join(os.path.dirname(os.path.abspath(__file__)), "__pycache__"), ignore_errors=True)

BASE_RE = re.compile(r'(<script id="__config" type="application/json">\{[^<]*?"base":\s*")([^"]*)(")')


def _other_language(config):
    """Lingua in costruzione, se non è quella predefinita."""
    i18n = config.plugins.get("i18n")
    if i18n is None or i18n.is_default_language_build:
        return None
    return i18n.current_language


def _rebase(html, lang):
    return BASE_RE.sub(lambda m: m.group(1) + posixpath.join(m.group(2), lang) + "/" + m.group(3), html, count=1)


def on_post_page(output, page, config):
    lang = _other_language(config)
    return _rebase(output, lang) if lang else output


def on_post_template(output_content, template_name, config):
    lang = _other_language(config)
    if template_name != "404.html" or not lang:
        return output_content
    path = os.path.join(config.site_dir, lang, "404.html")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(_rebase(output_content, lang))
    # Un contenuto vuoto fa saltare a MkDocs la scrittura di 404.html nella radice.
    return ""


@event_priority(-200)  # dopo mkdocs-static-i18n (-100), che scrive l'indice unico
def on_post_build(config):
    i18n = config.plugins.get("i18n")
    if i18n is None or i18n.building:
        return
    path = os.path.join(config.site_dir, "search", "search_index.json")
    if not os.path.isfile(path):
        return
    with open(path, encoding="utf-8") as f:
        index = json.load(f)
    docs = {lang: [] for lang in i18n.build_languages}
    for doc in index["docs"]:
        lang = doc["location"].split("/", 1)[0]
        if lang in docs and lang != i18n.default_language:
            doc["location"] = doc["location"][len(lang) + 1:]
        else:
            lang = i18n.default_language
        docs[lang].append(doc)
    for lang, entries in docs.items():
        folder = "" if lang == i18n.default_language else lang
        out = os.path.join(config.site_dir, folder, "search", "search_index.json")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with open(out, "w", encoding="utf-8") as f:
            json.dump({**index, "docs": entries}, f, ensure_ascii=False, separators=(",", ":"))
