# Contribute

Proxmox Community is open to everyone: you can fix a mistake, improve a lab, translate a page or propose a new guide. Every contribution goes through GitHub and is reviewed before publication.

## How to contribute

- **Found a mistake or have a question?** Open an [issue](https://github.com/ndecandia/NextGuard/issues) describing the page, the step and what you observed.
- **Want to propose a change or a guide?** Use a *pull request*:
  1. *fork* the [repository](https://github.com/ndecandia/NextGuard) and create a branch;
  2. edit or add the Markdown files in `docs/en/` (English) and/or `docs/it/` (Italian);
  3. check the preview locally (see below);
  4. open the pull request explaining what changes and on which Proxmox version you tested it.

New community guides go in `docs/en/guides/` or `docs/it/guides/`; the maintainers add them to the menu after the review.

## Local preview

You need Python 3:

```bash
python3 -m venv ~/venv-proxmox-community
~/venv-proxmox-community/bin/pip install -r requirements.txt
~/venv-proxmox-community/bin/mkdocs serve
```

The site is at `http://127.0.0.1:8000`. Before opening the pull request, check that `mkdocs build --strict` ends without warnings: missing links and images are reported.

## Guide template

Every lab and every guide follows the same structure. Copy this template:

```markdown
# Guide title

**Level:** basic | intermediate | advanced · **Duration:** about N minutes

## Dependencies

- **Previous labs or guides:** …
- **Machines and services:** … and the state they must be in
- **Software and images:** …
- **Credentials:** `<lab-password>`

## Objectives

- What you will be able to do at the end.

## How it works

The essential theory to understand what happens, with a diagram if it helps.

## Procedure

1. Numbered steps. Every action in the web interface has its screenshot,
   every command has its real output.

## Verification and tests

Tests that prove it works, also with simulated failures.

## Final state

What stays configured at the end, for whoever continues with other guides.

## What you learned

- The key concepts in a few lines.

## References

- Links to the official documentation.
```

## Rules

- **Real tests.** Only publish procedures you actually ran: commands, output and screenshots must come from your system. State the Proxmox VE version you used.
- **Screenshots.** PNG format, only the relevant ones, one for every meaningful action. Put them in `docs/images/<guide-name>/` and link them with a relative path, for example `../images/<guide-name>/01-screen.png`.
- **No sensitive data.** Never passwords, tokens, keys, public IP addresses or real names of people and companies. Use placeholders such as `<lab-password>` and obscure serial numbers and MAC addresses in the screenshots.
- **Language.** You can write in English, in Italian or both. A translated page must have **the same file name** in the two folders (`docs/en/…` and `docs/it/…`): this is how the language selector links them.
- **File names.** Lowercase, words separated by hyphens, in English: for example `ceph-pool-encryption.md`.
- **Style.** Short, clear sentences, numbered steps, one idea per paragraph. Explain the *why*, not only the *how*.

## License of contributions

By submitting a contribution you agree that it is published under the project licenses: **CC BY-SA 4.0** for content and **MIT** for code. See [About](about.md#licenses).
