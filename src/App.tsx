import React from 'react';
import styled from 'styled-components';
import DrawingCanvas from './components/DrawingCanvas';

const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  background-color: #f0f2f5;
  padding: 20px;
`;

const Title = styled.h1`
  color: #1a1a1a;
  margin-bottom: 20px;
  font-family: 'Arial', sans-serif;
`;

const App: React.FC = () => {
  return (
    <AppContainer>
      <Title>Drawing App</Title>
      <DrawingCanvas />
    </AppContainer>
  );
};

export default App; 