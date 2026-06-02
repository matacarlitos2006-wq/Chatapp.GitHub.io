import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import SignIn from './components/auth/SignIn';
import SignUp from './components/auth/SignUp';
import ConversationList from './components/chat/ConversationList';
import ChatView from './components/chat/ChatView';
import JoinInvite from './components/chat/JoinInvite';
import ContactsPage from './components/contacts/ContactsPage';
import ProfilePage from './components/profile/ProfilePage';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<ConversationList />} />
              <Route path="chat/:conversationId" element={<ChatView />} />
              <Route path="contacts" element={<ContactsPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="join/:code" element={<JoinInvite />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
