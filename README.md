react-gemini-boilerplate: Used to run the chatbot. 
gemini-node: used to extract text from pdf.

Dependencies required to run the chatbot (App.jsx) :

1. All dependencies [npm install]
2. React [npm install react react-dom]
3. Google generative ai for api call [npm install @google/generative-ai]
4. Recharts library for generating graphs and charts [npm install recharts]
5. Vite (build tool) [npm install -D vite @vitejs/plugin-react]

Dependencies required to extract text (pdf.js) : 

1. extracting text from given pdfs [npm install pdf-parse dotenv]

The extracted text gets stored in repex.json.
To add a new pdf, Add in pdf.js where all the other pdfs are stored, and run pdf.js. After that run App.jsx to see the results.
   
