# Shield Pro - React Web App

A modern React web application built with Vite, TypeScript, and ESLint.

## Getting Started

### Prerequisites

- Node.js 16+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

### Development

Start the development server:
```bash
npm run dev
```

The app will open automatically at `http://localhost:3000` with hot module replacement (HMR) enabled.

### Build

Create a production build:
```bash
npm run build
```

The output will be in the `dist` folder.

### Preview

Preview the production build locally:
```bash
npm run preview
```

### Linting

Check for linting errors:
```bash
npm run lint
```

Fix linting errors automatically:
```bash
npm run lint:fix
```

## Project Structure

```
shield-pro/
├── src/
│   ├── App.tsx           # Main App component
│   ├── App.css           # App styles
│   ├── main.tsx          # React entry point
│   └── index.css         # Global styles
├── index.html            # HTML entry point
├── vite.config.ts        # Vite configuration
├── tsconfig.json         # TypeScript configuration
├── eslintrc.cjs          # ESLint configuration
└── package.json          # Dependencies and scripts
```

## Technologies

- **React** - UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool and dev server
- **ESLint** - Code quality
- **CSS** - Styling

## License

MIT
