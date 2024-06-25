const axios = require('axios');
const { OpenAI } = require('openai');
const {VertexAI} = require('@google-cloud/vertexai');

require('dotenv').config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

const openai_client = new OpenAI({ apiKey: OPENAI_API_KEY });
const vertex_ai = new VertexAI({project: 'vote-right-421402', location: 'us-central1'});
const model = 'gemini-1.5-pro-001';

exports.getCandidateData = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  const zipCode = req.query.zipCode;
  const issue = req.query.issue;
  if (!zipCode) {
    return res.status(400).send('Missing zipCode parameter');
  }

  try {
    const url = `https://civicinfo.googleapis.com/civicinfo/v2/representatives?address=postal_code:${zipCode}|country:US&key=${GOOGLE_API_KEY}`;
    const response = await axios.get(url);
    
    if (response.data && response.data.officials) {
      const officials = response.data.officials;

      // Fetch additional details for each official
      const details = await getCandidateDetails(officials, issue);

      // Combine the initial response with the new details
      const result = {
        ...response.data,
        details: details
      };

      return res.status(200).send(result);
    } else {
      return res.status(404).send('No officials found');
    }
  } catch (error) {
    console.error(error);
    return res.status(500).send('An error occurred');
  }
};

async function getCandidateDetails(list_of_reps, issue) {
  const generativeModel = await initializeGeminiModel(issue);
  let first_reps = [list_of_reps[0], list_of_reps[1]]
  const promises = first_reps.map(rep => getDetailsForRepGemini(generativeModel, rep));
  return await Promise.all(promises);
}

// Mock call to openAPI
function getDetailsForRepMock(rep) {
  const mockResponse = {
    name: rep.name,
    details: `Mock response detailing the achievements and work of ${rep.name} while in office. This is for testing purposes.`
  };

  // Simulate a delay
  return new Promise(resolve => {
    setTimeout(() => resolve(mockResponse), 2000);
  });
}

// OpenAI GPT-3 call
async function getDetailsForRepGPT(rep) {
  const message = {
    role: "user",
    content: `Write me a paragraph about what ${rep.name} has done while in office.`
  };

  try {
    const response = await openai_client.chat.completions.create({
      messages: [message],
      model: "gpt-3.5-turbo",
    });

    return {
      name: rep.name,
      details: response.choices[0].message.content  // Assuming API response structure, adjust as needed
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
}


async function initializeGeminiModel(issue){
  const generativeModel = vertex_ai.preview.getGenerativeModel({
    model: model,
    generationConfig: {
      'maxOutputTokens': 2000,
      'temperature': 1,
      'topP': 0.95,
    },
    safetySettings: [
      {
          'category': 'HARM_CATEGORY_HATE_SPEECH',
          'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
      },
      {
          'category': 'HARM_CATEGORY_DANGEROUS_CONTENT',
          'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
      },
      {
          'category': 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
      },
      {
          'category': 'HARM_CATEGORY_HARASSMENT',
          'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
      }
    ],
    systemInstruction: {
      parts: [{"text": `You are an informed citizen who cares about ${issue}`}]
    },
  });
  console.log(generativeModel);
  return generativeModel;
}

async function generateGeminiContent(generativeModel, rep) {
  const req = {
    contents: [
      {role: 'user', parts: [{text: `Tell me about what ${rep.name} has done while in office`}]}
    ],
  };

  const streamingResp = await generativeModel.generateContent(req);

  return {
    name: rep.name,
    details: streamingResp.response
  }
}


async function getDetailsForRepGemini(generativeModel, rep){
  // Instantiate the model first and pass it in. ALSO: This thing is configured to have a quota so I can't run it for all reps
  return generateGeminiContent(generativeModel, rep);

}
