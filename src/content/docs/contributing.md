---
title: Contribute
description: How to fix a mistake, improve a lab, translate a page or propose a new guide for Proxmox Community.
---

Proxmox Community is open to everyone: you can fix a mistake, improve a lab, translate a page or propose a new guide. Every contribution goes through GitHub and is reviewed before publication.

## How to contribute

- **Found a mistake or have a question?** Open an [issue](https://github.com/Next-Guard/Proxmox/issues) describing the page, the step and what you observed.
- **Want to propose a change or a guide?** Use a *pull request*:
  1. *fork* the [repository](https://github.com/Next-Guard/Proxmox) and create a branch;
  2. edit or add the Markdown files in `src/content/docs/` (English) and/or `src/content/docs/it/` (Italian);
  3. check the preview locally (see below);
  4. open the pull request explaining what changes and on which Proxmox version you tested it.

New community guides go in `src/content/docs/guides/` or `src/content/docs/it/guides/`; the maintainers add them to the menu (`src/sidebar.mjs`) after the review.

## Local preview

You need Node.js 22.23 or later:

```bash
npm ci
npm run dev
```

The site is at `http://localhost:4321`. Before opening the pull request, run `npm run build`: it must end without errors. The build stops on broken links and anchors between pages and on missing images, then checks the generated site.

## Guide template

Every lab and every guide follows the same structure. Copy this template into a new `.md` file:

```markdown
---
title: Guide title
level: basic | intermediate | advanced
duration: about N minutes
---

## Dependencies

- **Previous labs or guides:** …
- **Machines and services:** … and the state they must be in
- **Software and images:** …
- **Credentials:** `<lab-password>`

## Objectives

- The operational result the reader will be able to verify at the end.

## How it works

Only the theory this test needs, with a diagram if it helps.
Point to earlier guides for everything else.

## Procedure

1. Numbered steps. Every meaningful action in the web interface has its
   screenshot; every command is followed by the output from your system.

## Verification and tests

What to check and which result counts as success; simulated failures
when they help explain the behavior.

## Final state

What stays configured at the end, for whoever continues with other guides.

## What you learned

- The technical decision the reader can now make.

## References

- Links to the official documentation.
```

The title goes in the `title` field, not in a `# Title` heading: the site shows it at the top of the page, with the level and the duration.

## Commands, output and notes

A **command** block has the machine where it runs as its title: the site shows it as a terminal with a copy button. The **output** that follows goes in a block marked `output`: it gets a muted frame and no copy button, so whoever copies takes only the command.

````markdown
```bash title="root@desopve01"
pvecm status | grep -E "^Quorate|Total votes"
```

```text output
Quorate:          Yes
Total votes:      3
```
````

- Consoles that are not a shell (RouterOS, `qm monitor`) use `text` with `frame="terminal"`: `` ```text title="RouterOS — rtr-core" frame="terminal" ``.
- Configuration files and scripts that are not commands use the language name without a title (`yaml`, `json`, `toml`, `hcl`…).
- Notes and warnings are *asides*: `:::note`, `:::tip`, `:::caution` or `:::danger`, with an optional title in square brackets, closed by `:::`.

  ```markdown
  :::caution[Watch the addresses]
  `172.32.199.0/24` is **not** a private address.
  :::
  ```

- Diagrams are written in Mermaid, in a `` ```mermaid `` block.

## Rules

- **Real tests.** Only publish procedures you actually ran: commands, output and screenshots must come from your system. State the Proxmox VE version you used.
- **Measurements and interpretations.** Keep what you measured apart from how you explain it. If the test does not verify an interpretation, say so and name the check that would. For benchmarks, describe the versions, the storage configuration and the cache layers involved.
- **Screenshots.** PNG format, only the relevant ones, one for every meaningful action. Put them in `src/assets/images/<guide-name>/` and link them with a relative path: `../../assets/images/<guide-name>/01-screen.png` from an English page, `../../../assets/images/<guide-name>/01-screen.png` from an Italian page. The site converts and resizes them.
- **Links between pages.** Use the page address with the final slash: `/10-zfs/#anchor` in English, `/it/10-zfs/#ancora` in Italian. Downloadable files go in `public/files/<guide-name>/` and are linked as `/files/<guide-name>/file-name`.
- **No sensitive data.** Never passwords, tokens, keys, public IP addresses or real names of people and companies. Use placeholders such as `<lab-password>` and obscure serial numbers and MAC addresses in the screenshots.
- **Language.** You can write in English, in Italian or both. A translated page must have **the same file name** in the two folders (`src/content/docs/…` and `src/content/docs/it/…`): this is how the language selector links them.
- **File names.** Lowercase, words separated by hyphens, in English: for example `ceph-pool-encryption.md`. No file or folder may start with `.` or `_`.
- **Style.** Short, clear sentences, numbered steps, one idea per paragraph. Explain the *why*, not only the *how*.

## License of contributions

By submitting a contribution you agree that it is published under the project licenses: **CC BY-SA 4.0** for content and **MIT** for code. See [About](/about/#licenses).
