# Adaba OIS — Operational Information System

A full-stack prototype web application for the Adaba Operational Information System (OIS). This project is organized into two main components: a **backend** API server and a **frontend** user interface.

## Project Structure

```
adaba-ois/
├── backend/       # Server-side application (API, database, business logic)
├── frontend/      # Client-side application (UI, user interactions)
├── .gitignore     # Files and directories excluded from version control
└── README.md      # Project documentation
```

## Overview

The Adaba OIS prototype supports operational workflows and information management with a decoupled architecture:

- **backend/** — Server-side API, database models, authentication, and business logic.
- **frontend/** — User interface, component library, and client-side routing.

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm or yarn

### Installation

Clone the repository and install dependencies for each component:

```bash
git clone https://github.com/Gbedasko/adaba-ois.git
cd adaba-ois
```

Then follow the setup instructions in `backend/README.md` and `frontend/README.md`.

## Environment Variables

Sensitive configuration (API keys, database credentials, etc.) is stored in `.env` files which are excluded from version control. Copy `.env.example` to `.env` in each subdirectory and fill in the required values.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

## License

This project is currently unlicensed.
