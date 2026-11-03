# Dragology

Dragology is a library for making high-quality, novel drag-and-drop interfaces.

The best explanation of the ideas behind Dragology can be found at [Declarative Dragging](https://declarative-dragging.github.io/). This README focuses on getting you started using the library itself.

## Install

```
npm install dragology
```

Or use your package manager of choice.

## Using Dragology

While we have not yet prepared documentation for Dragology, we have other resources which might be enough to get you going:

- Dragology is based on some new concepts: *model-driven* and *composable* dragging. We suggest starting with the [Declarative Dragging](https://declarative-dragging.github.io/) homepage and checking out videos / PDFs from there.
- [`examples/consumer`](examples/consumer), in this repository, is a self-contained example of importing and using Dragology in a Vite project. We hope it helps you get started.
- We have a lot of demos. You can play with them [here](https://declarative-dragging.github.io/dragology/#/demos) and then look in [`src/demos`](src/demos) to see how they're built.
- [`docs/AGENTS.md`](docs/AGENTS.md) is written by LLMs, intended for LLMs working with the Dragology library. While we regret offering you slop in lieu of actual documentation, it's probably better than nothing.


## Working in this repo

To work on Dragology itself (not necessary to use it as a library!), clone this repo and run:

```bash
pnpm install
pnpm run dev
```

Then open http://localhost:5173 (or whatever the CLI output suggests) to view the Vite dev server with auto-refreshing demos.

[`AGENTS.md`](AGENTS.md) (in the root directory) has some helpful pointers on navigating the development process in this repo, if you can stomach the indignity of being talked at like an LLM.
