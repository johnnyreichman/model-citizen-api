const express = require('express');
const candidateData = require('./candidateData');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/getCandidateData', candidateData.getCandidateData);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});