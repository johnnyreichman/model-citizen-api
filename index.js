require('dotenv').config({ path: `.env.${process.env.NODE_ENV}` })

const candidateData = require('./candidateData');

exports.candidateData = candidateData.getCandidateData;
