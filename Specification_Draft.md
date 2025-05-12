# Memorise NLP Web Interface – Project Specification

**Author:** Adam Turčan (Bc. student)  
**Project Type:** Individual Software Project  
**Platform:** [Memorise Project](https://memorise.sdu.dk)

---

## Objective

Develop a user-friendly **React-based frontend** for the Memorise NLP platform.  
The application will allow users to upload historical documents, process them through various NLP APIs, and manage results in **personal workspaces**.

---

## Core Features

### 1. User Authentication

- Registration and login system.
- Each user has a **personal workspace**, used for document management.

### 2. Document Management

- Upload plain text documents manually or from file.
- View, rename, delete or edit documents via interactive workspace, ( export `??`).

### 3.Interactive Workspace

- Allow users to view and interact with all documents and results.
- Enable inline editing (e.g., updating / deleting / adding - tags, segments, entities, ).

### 4.NLP Processing Pipeline

Integrate the following NLP components from Memorise:

- **Text Segmentation**  
  (e.g., diary entry or topic-based splitting)

- **Named Entity Recognition (NER)**  
  (people, places, organizations, time/date with character offsets...)

- **Semantic Tagging**  
  (subject keywords using the VHA thesaurus)

- **SWC Term Matching (PPX)**  
  (keyword extraction using external thesauri like NIOD)

- **Machine Translation**  
  (multilingual support: en, de, cs, pl, etc.)

Each result will be:

- Displayed in the UI (with highlights or lists)
- Editable by the user
- Saved per document in the workspace

---

## Tech Stack

```

| Layer         | Technology                 |
| ------------- | -------------------------- |
| Frontend      | React + Vite               |
| Styling       | Tailwind CSS / Material UI |
| Routing       | React Router               |
| State Storage | localStorage               |
| API Calls     | Axios / fetch              |

```

---

## Possible Project Structure

```
src/
├── components/
│ ├── Auth/
│ ├── Documents/
│ ├── NLPTools/
│ ├── Workspace/
├── context/
├── hooks/
├── utils/
├── pages/
│ ├── Login.jsx
│ ├── Register.jsx
│ ├── Dashboard.jsx
│ ├── NLPView.jsx
├── App.jsx
├── main.jsx
```

---

## Roadmap

0. Gather all necessary information about the APIs and pipeline
1. Design UI
2. Implement login and registration screens (could be based on mock data if APIs not ready)
3. Add document upload & local storage logic
4. Integrate segmentation API
5. Add remaining NLP tools (NER, tagging, translation, etc.)
6. Enable inline result editing
7. Finalize UI/UX.
8. Testing and polish

---

## Stretch Goals

- Light/Dark mode toggle `??`
- Drag & drop file uploads
- Export modified results to `.json` or `.txt` `??`
- Version history for edits `??`
- Highlight-based text editing

---

## Notes

- This project **does not use its own backend**.  
  All operations are done through the existing **Memorise APIs**.
- Primary focus is on **intuitive UI design** and smooth data handling.

---

_This document will serve as the working specification and can be refined based on feedback or evolving project scope._
