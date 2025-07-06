import React, { useState, useEffect, useRef } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import repexData from "../../gemini-node/repex.json";

import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import "./App.css";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
const PIE_COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

function calculateTextSimilarity(query, text) {
  const queryWords = query.toLowerCase().split(/\W+/).filter(word => word.length > 2);
  const textWords = text.toLowerCase().split(/\W+/).filter(word => word.length > 2);
  
  
  const queryWordFreq = {};
  const textWordFreq = {};
  
  queryWords.forEach(word => {
    queryWordFreq[word] = (queryWordFreq[word] || 0) + 1;
  });
  
  textWords.forEach(word => {
    textWordFreq[word] = (textWordFreq[word] || 0) + 1;
  });
  
  let score = 0;
  let queryWordMatches = 0;
  
  
  Object.keys(queryWordFreq).forEach(queryWord => {
    let bestMatch = 0;
    
    Object.keys(textWordFreq).forEach(textWord => {
      
      if (textWord === queryWord) {
        bestMatch = Math.max(bestMatch, 1.0);
      }
      
      else if (textWord.includes(queryWord) && queryWord.length > 3) {
        bestMatch = Math.max(bestMatch, 0.7);
      }
      else if (queryWord.includes(textWord) && textWord.length > 3) {
        bestMatch = Math.max(bestMatch, 0.5);
      }
    });
    
    if (bestMatch > 0) {
      queryWordMatches++;
      score += bestMatch * queryWordFreq[queryWord];
    }
  });
  
 
  const relevanceRatio = queryWordMatches / queryWords.length;
  const finalScore = queryWords.length > 0 ? (score * relevanceRatio) / queryWords.length : 0;
  
  return finalScore;
}

//
function searchPDFContent(query, threshold = 0.3) {
  
  const generalKeywords = ['hey', 'hi', 'hello', 'thanks', 'thank you', 'what', 'how', 'why', 'when', 'where'];
  const queryLower = query.toLowerCase();
  
  
  const results = repexData.map(item => ({
    ...item,
    similarity: calculateTextSimilarity(query, item.extractedText)
  }))
  .filter(item => item.similarity > threshold)
  .sort((a, b) => b.similarity - a.similarity)
  .slice(0, 2); // Reduced to top 2 most relevant results
  
  return results;
}

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const chatRef = useRef(null);
  const messagesEndRef = useRef(null);
  
  const parseChartData = (text) => {
    try {
      const chartDataMatch = text.match(/```json_chart\n([\s\S]*?)\n```/);
      if (chartDataMatch && chartDataMatch[1]) {
        const jsonString = chartDataMatch[1];
        const chartData = JSON.parse(jsonString);
        if (chartData.type && chartData.data && Array.isArray(chartData.data)) {
          return { type: chartData.type, data: chartData.data, title: chartData.title || "" };
        }
      }
    } catch (e) {
      console.error("Failed to parse chart data:", e);
    }
    return null;
  };

  const Message = ({ message }) => {
    const chart = parseChartData(message.text);
    //for charts
    if (chart) {
      return (
        <div className={`message ${message.sender}`}>
          <p>{chart.title || "Chart"}</p>
          <div className="chart-container">
            {chart.type === "line" && chart.data.length > 0 && (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chart.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey={Object.keys(chart.data[0])[0]} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {Object.keys(chart.data[0]).slice(1).map((key, idx) => (
                    <Line key={key} type="monotone" dataKey={key} stroke={PIE_COLORS[idx % PIE_COLORS.length]} activeDot={{ r: 8 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
            {chart.type === "pie" && chart.data.length > 0 && (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chart.data}
                    dataKey={Object.keys(chart.data[0])[1]}
                    nameKey={Object.keys(chart.data[0])[0]}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    fill="#8884d8"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {chart.data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
            {(!chart.data || chart.data.length === 0) && <p>No data to render chart.</p>}
          </div>
          {message.text.replace(/```json_chart\n([\s\S]*?)\n```/, '').trim() && (
            <p className="chart-explanation">{message.text.replace(/```json_chart\n([\s\S]*?)\n```/, '').trim()}</p>
          )}
        </div>
      );
    } else {
      return (
        <div className={`message ${message.sender}`}>
          <p>{message.text}</p>
          {message.pdfSources && (
            <div className="pdf-sources">
              <small><strong>Sources:</strong> {message.pdfSources.join(", ")}</small>
            </div>
          )}
        </div>
      );
    }
  };

  useEffect(() => {
    chatRef.current = model.startChat({
      history: [],
      generationConfig: {
        maxOutputTokens: 1500, // Increased for PDF content
      },
      systemInstruction: {
        parts: [
          {
            text: `Alright, greetings! I am Titan, your friendly AI assistant, and I'm primed and ready to assist you.

My core purpose is to answer your questions, and I'll be doing so with a distinct industrial and market perspective. This means when you ask me something, I'll aim to provide insights related to:

Industry Dynamics: How specific industries operate, their structures, key players, and value chains.
Market Trends: Current and emerging trends, market sizing, growth drivers, and potential disruptors.
Economic Impact: How economic factors influence industries and markets, and vice-versa.
Competitive Landscape: Analysis of competitors, their strategies, strengths, and weaknesses.
Reporting Understanding: Tell the user how their data aligns with reporting standards like BRSR and GRI.
Competitor Benchmarking: Compare the given data with industry benchmarks.
Technological Adoption & Impact: How new technologies are being adopted and how they're reshaping industries.
Supply Chain & Operations: Considerations around manufacturing, logistics, sourcing, and operational efficiency.
Regulatory Environment: The impact of policies and regulations on industries.
Investment & Financial Performance: Trends in investment, M&A activity, and financial health of sectors/companies.

IMPORTANT: I now have access to specialized PDF content that contains detailed company reports and industry data. However, I will:
1. ONLY use PDF content when it's relevant to the user's specific question
2. For general industry questions or topics not covered in the PDFs, I'll use my general knowledge
3. I will NOT force PDF content into answers where it doesn't belong
4. When I do use PDF information, I'll indicate which document I referenced
5. I maintain all my chart generation capabilities regardless of whether I use PDF content or general knowledge

IMPORTANT: When you determine that a chart would be useful to illustrate data, you MUST respond by wrapping the chart's data as a JSON object within triple backticks, specifically prefixed with \`\`\`json_chart\`. This JSON object MUST contain a \`type\` field ("line" or "pie"), a \`title\` field (string), and a \`data\` array. After the \`\`\`json_chart\`\`\` block, you can provide an explanation of the chart.

Here are examples of how you should structure the JSON for charts:**

Example for a Line Chart:
\`\`\`json_chart
{
  "type": "line",
  "title": "Global EV Sales (Millions of Units)",
  "data": [
    {"year": 2020, "sales": 3.1},
    {"year": 2021, "sales": 6.6},
    {"year": 2022, "sales": 10.5},
    {"year": 2023, "sales": 14.2}
  ]
}
\`\`\`
Explanation: This line chart shows the rapid growth of global electric vehicle sales from 2020 to 2023, reflecting increasing adoption and market expansion.

Example for a Pie Chart:
\`\`\`json_chart
{
  "type": "pie",
  "title": "Global Smartphone Market Share Q1 2024",
  "data": [
    {"company": "Samsung", "share": 20.8},
    {"company": "Apple", "share": 17.3},
    {"company": "Xiaomi", "share": 14.1},
    {"company": "Huawei", "share": 10.3},
    {"company": "Others", "share": 37.5}
  ]
}
\`\`\`
Explanation: The pie chart illustrates the distribution of global smartphone market share in Q1 2024, with Samsung leading, followed by Apple and Xiaomi.

Always remember to provide a concise explanation for the chart after the \`\`\`json_chart\`\`\` block. If a chart is not applicable, simply provide a textual answer.

I'm ready when you are! Please, ask your question, and let's explore it from an industrial and market standpoint. If I have relevant PDF content that relates to your query, I'll incorporate those insights into my response.`,
          },
        ],
      },
    });

    setMessages([
      {
        sender: "ai",
        text: "Greetings! I am Titan, your friendly AI assistant. How can I assist you today?",
      },
    ]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (input.trim() === "" || isLoading) return;

    setError(null);
    const userMessage = { sender: "user", text: input };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      if (!chatRef.current) {
        throw new Error("Chat session not initialized.");
      }

      // Search for relevant PDF content
      const relevantPDFContent = searchPDFContent(input);
      
      let enhancedPrompt = input;
      let pdfSources = [];

      // Only enhance prompt if we found highly relevant PDF content
      if (relevantPDFContent.length > 0 && relevantPDFContent[0].similarity > 0.4) {
        pdfSources = relevantPDFContent.map(item => item.pdfFileName);
        
        const pdfContext = relevantPDFContent
          .map(item => `[Document: ${item.pdfFileName}]: ${item.extractedText}`)
          .join('\n\n');

        enhancedPrompt = `You have access to some company documents that may be relevant to this question: "${input}"

AVAILABLE DOCUMENT CONTEXT:
${pdfContext}

Instructions:
1. ONLY use the document information if it's directly relevant to answering the user's question
2. If the documents don't contain relevant information, answer using your general knowledge about industries and markets
3. If you do use document information, briefly indicate which document you referenced
4. Provide comprehensive analysis combining document insights (when relevant) with your general industry knowledge
5. Do not force document content into your answer if it's not relevant

Answer the user's question:`;
      }

      const result = await chatRef.current.sendMessage(enhancedPrompt);
      const response = await result.response;
      const aiText = response.text();

      const aiMessage = { 
        sender: "ai", 
        text: aiText,
        pdfSources: pdfSources.length > 0 && relevantPDFContent[0]?.similarity > 0.4 ? pdfSources : null
      };
      setMessages((prevMessages) => [...prevMessages, aiMessage]);
    } catch (err) {
      console.error("Error sending message:", err);
      setError(
        "Failed to get response. Please try again. (Check console for details)"
      );
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          sender: "ai",
          text: "Sorry, I couldn't process that request right now. Please try again. (Check console for details)",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      handleSendMessage();
      e.preventDefault();
    }
  };

  return (
    <div className="chatbot-container">
      <h1>Industrial & Market Chatbot</h1>
      <div className="knowledge-indicator">
        <small> Connected to {repexData.length} document(s) | Enhanced with PDF Knowledge Base</small>
      </div>

      <div className="chat-window">
        {messages.map((msg, index) => (
          <Message key={index} message={msg} />
        ))}
        {isLoading && (
          <div className="message ai loading">
            <p>Analyzing...</p>
          </div>
        )}
        {error && (
          <div className="message error">
            <p>{error}</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask Titan about industries and markets."
          disabled={isLoading}
          rows="3"
        />
        <button onClick={handleSendMessage} disabled={isLoading}>
          {isLoading ? "Send" : "Send"}
        </button>
      </div>
    </div>
  );
}

export default App;