import { Link } from "react-router-dom";
import { useTitle } from "./useTitle";

const linkClass = "text-blue-700 underline hover:text-blue-900";

export function IndexPage() {
  useTitle("Dragology");
  return (
    <div className="min-h-screen bg-gray-50 select-text">
      <div className="max-w-prose mx-auto px-5 py-16 text-gray-800 leading-relaxed">
        <h1 className="text-4xl font-normal mb-8">Dragology demos</h1>

        <p className="mb-6">
          This page hosts demos built from the{" "}
          <a
            href="https://github.com/declarative-dragging/dragology"
            className={linkClass}
          >
            Dragology repository
          </a>
          . For more on Dragology, please visit{" "}
          <a
            href="https://declarative-dragging.github.io/"
            className={linkClass}
          >
            Declarative Dragging
          </a>
          .
        </p>

        <ul className="list-disc pl-6 space-y-1">
          <li>
            <Link to="/demos" className={linkClass}>
              Demos
            </Link>
          </li>
          <li>
            <Link to="/study" className={linkClass}>
              Study
            </Link>
          </li>
        </ul>

        <footer className="mt-16 text-xs text-gray-400 font-mono">
          {__COMMIT_HASH__}
        </footer>
      </div>
    </div>
  );
}
