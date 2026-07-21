import { Navigate, Route, Routes } from 'react-router-dom';
import EditorView from './EditorView.jsx';
import HomePage from './home/HomePage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/file/:projectId" element={<EditorView />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
