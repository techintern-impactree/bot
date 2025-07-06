const fs = require('fs');
const pdf = require('pdf-parse');
// const { GoogleGenerativeAI } = require('@google/generative-ai'); 
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error("Error: GEMINI_API_KEY is not set in your .env file.");
    process.exit(1);
}
// const genAI = new GoogleGenerativeAI(API_KEY); 

function formatExtractedTextForReadability(text) {
    let formattedText = text;

    // 100usd -> 100 usd
    formattedText = formattedText.replace(/(\d)(?=[a-zA-Z%€$£\[\]\(\)\/])/g, '$1 ');

    //scope1:100 _> scope 1: 100 
    formattedText = formattedText.replace(/([a-zA-Z%€$£\[\]\(\)\/])(?=\d)/g, '$1 ');
    
    // 100% -> 100 %
    formattedText = formattedText.replace(/([a-zA-Z0-9])([%€$£\(\)\[\]\{\}])/g, '$1 $2'); // Before symbol
    formattedText = formattedText.replace(/([%€$£\(\)\[\]\{\}])([a-zA-Z0-9])/g, '$1 $2'); // After symbol

    //10-20 -> 10 - 20
    formattedText = formattedText.replace(/(\d)([^\s\w.,])(\d)/g, '$1 $2 $3');

    // Rule 4: Replace multiple spaces with a single space to clean up
    formattedText = formattedText.replace(/\s+/g, ' ').trim();

    return formattedText;
}


async function processPDFs(pdfFilePaths, outputJsonFilePath) {
    let allExtractedData = [];

    
    try {
        if (fs.existsSync(outputJsonFilePath)) {
            const existingJsonString = fs.readFileSync(outputJsonFilePath, 'utf8');
            allExtractedData = JSON.parse(existingJsonString);
            console.log(`Loaded existing data from ${outputJsonFilePath} (${allExtractedData.length} entries)`);
        }
    } catch (readError) {
        console.error(`Error reading existing ${outputJsonFilePath}:`, readError);
        allExtractedData = []; 
    }

    
    for (let i = 0; i < pdfFilePaths.length; i++) {
        const pdfFilePath = pdfFilePaths[i];
        
        const fileName = pdfFilePath.split('\\').pop().split('/').pop();

        const existingEntry = allExtractedData.find(entry => entry.pdfFileName === fileName);
        if (existingEntry) {
            console.log(`   Skipping ${fileName} - already processed`);
            continue;
        }

        try {
            console.log(`\n📄 Processing PDF ${i + 1}/${pdfFilePaths.length}: ${fileName}`);

            
            const dataBuffer = fs.readFileSync(pdfFilePath);
            
            const data = await pdf(dataBuffer);

            let extractedText = data.text;
            const numPages = data.numpages;
            
            
            extractedText = formatExtractedTextForReadability(extractedText);
           

            const wordCount = extractedText.split(/\s+/).length;

            console.log(`   Extracted: ${numPages} pages, ~${wordCount} words`);
            console.log(`   Saving extracted text directly...`);

            
            const newEntry = {
                pdfFileName: fileName,
                extractedText: extractedText, 
                metadata: {
                    numPages: numPages,
                    wordCount: wordCount, 
                    processedDate: new Date().toISOString(),
                    filePath: pdfFilePath,
                }
            };

            allExtractedData.push(newEntry);

            // Save after each successful processing (incremental backup)
            try {
                const jsonString = JSON.stringify(allExtractedData, null, 2);
                fs.writeFileSync(outputJsonFilePath, jsonString, 'utf8');
                console.log(`   Progress saved to ${outputJsonFilePath}`);
            } catch (saveError) {
                console.error(`   Warning: Could not save progress to JSON file:`, saveError);
            }

            console.log(`   Completed processing ${fileName}`);

        } catch (error) {
            console.error(`Error processing ${pdfFilePath}:`, error.message);
            
        }
    }

    
    try {
        const jsonString = JSON.stringify(allExtractedData, null, 2);
        fs.writeFileSync(outputJsonFilePath, jsonString, 'utf8');

        console.log(`\n Processing Complete!`);
        console.log(` Summary:`);
        console.log(`   - Total entries: ${allExtractedData.length}`);
        console.log(`   - Output file: ${outputJsonFilePath}`);
        console.log(`   - File size: ${(fs.statSync(outputJsonFilePath).size / 1024).toFixed(2)} KB`);

        // Display processed files
        console.log(`   - Processed files:`);
        allExtractedData.forEach((entry, index) => {
            console.log(`     ${index + 1}. ${entry.pdfFileName} (${entry.metadata.numPages} pages)`);
        });

    } catch (writeError) {
        console.error(` Error saving final JSON:`, writeError);
    }
}

// Configuration
const pdfFiles = [
    'C:\\Users\\KIIT\\Desktop\\AR_24163_BAJAJ-AUTO_2023_2024_2106202418557.pdf',
    'C:\\Users\\KIIT\\Desktop\\FINEORG_25072024183125_FOILBRSR.pdf',
    'C:\\Users\\KIIT\\Desktop\\CSCOMPLIANCE_19072024184427_BRSR.pdf',
    

];

const outputFile = './repex.json';


console.log(' Starting PDF Text Extraction Pipeline...');
console.log(` PDFs to process: ${pdfFiles.length}`);
console.log(` Output file: ${outputFile}`);


const missingFiles = pdfFiles.filter(file => !fs.existsSync(file));
if (missingFiles.length > 0) {
    console.error('Missing PDF files:');
    missingFiles.forEach(file => console.error(`   - ${file}`));
    process.exit(1); ng
}

// Start processing
processPDFs(pdfFiles, outputFile)
    .then(() => {
        console.log('\n All done! Raw PDF text extraction complete and saved.');
    })
    .catch((error) => {
        console.error('\n Fatal error during PDF processing:', error);
        process.exit(1);
    });