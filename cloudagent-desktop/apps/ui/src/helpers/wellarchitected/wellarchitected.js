import { wellarchitected_aws_rules_mapping } from './wellarchitected_aws_rules_mapping';

/**
 * Parse Well-Architected answers and populate Context with assessment results
 * @param {Array} answers - Array of WA questions/answers
 * @param {Object} assessmentResults - Assessment scan results by category
 * @param {Object} accountContextQuestions - Account context from Express Review
 * @returns {Array} - Parsed answers with Context populated
 */
export const parseWellArchitectedAnswers = (
  answers,
  assessmentResults,
  accountContextQuestions = {}
) => {
  let results = [];
  const questionMapping = { ...wellarchitected_aws_rules_mapping };

  for (const answer of answers) {
    const lensAlias = answer.LensAlias || 'wellarchitected';

    if (!answer.ChoiceAnswerSummaries) {
      answer.ChoiceAnswerSummaries = [];
    }

    let relatedAssessmentResults = [];
    const answerMapping = questionMapping[lensAlias]?.[answer.QuestionId]?.answers || {};

    for (const choice of answer.Choices || []) {
      if (!choice.Context) {
        choice.Context = {
          passed: [],
          failed: [],
          notapplicable: [],
          accountContext: [],
        };
      } else {
        choice.Context.passed = [];
        choice.Context.failed = [];
        choice.Context.notapplicable = [];
        choice.Context.accountContext = [];
      }

      // Add details from account context questions
      if (accountContextQuestions[answer.QuestionId]) {
        const matches = accountContextQuestions[answer.QuestionId].filter(
          (match) => match.wellArchitectedAnswerId === choice.ChoiceId
        );
        if (matches.length > 0) {
          choice.Context.accountContext = matches;
        }
      }

      // Map assessment rules to choices
      if (answerMapping[choice.ChoiceId]) {
        for (const rule of answerMapping[choice.ChoiceId]) {
          const service = Object.keys(rule)[0];
          const ruleId = rule[service];

          const ruleResults = getResultItem(assessmentResults, service, ruleId);

          if (ruleResults) {
            relatedAssessmentResults.push(ruleResults);

            if (ruleResults.result.failed.length > 0) {
              choice.Context.failed.push({
                title: `${ruleResults.title} (${ruleResults.result.failed.length})`,
                id: ruleResults.id,
                description: ruleResults.description,
                resources: ruleResults.result.failed,
              });
            }
            if (ruleResults.result.passed.length > 0) {
              choice.Context.passed.push({
                title: `${ruleResults.title} (${ruleResults.result.passed.length})`,
                id: ruleResults.id,
                description: ruleResults.description,
                resources: ruleResults.result.passed,
              });
            }
            if (
              ruleResults.result.failed.length === 0 &&
              ruleResults.result.passed.length === 0
            ) {
              choice.Context.notapplicable.push({
                title: `${ruleResults.title}`,
                id: ruleResults.id,
                description: ruleResults.description,
                resources: [],
              });
            }
          }
        }
      }
    }

    results.push({
      ...answer,
      RelatedAssessmentResults: relatedAssessmentResults,
      Notes: answer.AdditionalDetails?.data?.Notes || answer.Notes || '',
    });
  }

  return results;
};

/**
 * Get a specific rule result from assessment results
 * @param {Object} assessmentResults - Assessment results by category
 * @param {string} category - Service category (e.g., 'iam', 's3')
 * @param {string} id - Rule ID
 * @returns {Object|null} - Rule result or null if not found
 */
const getResultItem = (assessmentResults, category, id) => {
  const results = assessmentResults?.[category]?.results || [];
  const match = results.find((result) => result.id === id);
  return match ? { ...match } : null;
};

/**
 * Map account context from Well-Architected Express Review to questions
 * @param {Array} customWellArchitectedQuestions - Custom WA questions
 * @param {Object} accountContext - Answered context by question ID
 * @returns {Object} - Mapped context by WA question ID
 */
export const mapAccountContextToWellArchitected = (
  customWellArchitectedQuestions,
  accountContext
) => {
  let customQuestionsToWellArchitectedMappings = {};

  for (const answeredQuestionId of Object.keys(accountContext).filter(
    (question) => accountContext[question].length > 0
  )) {
    const customQuestionIndex = customWellArchitectedQuestions.findIndex(
      (question) => question.questionId === answeredQuestionId
    );

    if (customQuestionIndex === -1) continue;

    const customQuestionText =
      customWellArchitectedQuestions[customQuestionIndex].questionText;

    for (const selectedAnswer of accountContext[answeredQuestionId]) {
      const customAnswerIndex = customWellArchitectedQuestions[
        customQuestionIndex
      ].answers.findIndex((answer) => answer.answerId === selectedAnswer);

      if (customAnswerIndex === -1) continue;

      const customAnswerText =
        customWellArchitectedQuestions[customQuestionIndex].answers[
          customAnswerIndex
        ].answerText;

      for (const mapping of customWellArchitectedQuestions[customQuestionIndex]
        .answers[customAnswerIndex].mapping || []) {
        const { wellArchitectedQuestionId, wellArchitectedAnswerId } = mapping;

        if (!customQuestionsToWellArchitectedMappings[wellArchitectedQuestionId]) {
          customQuestionsToWellArchitectedMappings[wellArchitectedQuestionId] = [];
        }

        customQuestionsToWellArchitectedMappings[wellArchitectedQuestionId].push({
          wellArchitectedAnswerId,
          customQuestionText,
          customAnswerText,
        });
      }
    }
  }

  return customQuestionsToWellArchitectedMappings;
};

/**
 * Map Well-Architected analysis to account context
 * @param {Array} analysis - Analysis results from Express Review
 * @param {Object} waQuestionsMapping - WA questions mapping
 * @param {Object} accountContext - Current account context
 * @returns {Object} - Updated account context
 */
export const mapWellArchitectedAnalysisToAccountContext = (
  analysis,
  waQuestionsMapping,
  accountContext
) => {
  for (const answer of analysis) {
    const waQuestionId = waQuestionsMapping?.[answer.id]?.waQuestionId || '';

    if (!accountContext[waQuestionId]) {
      accountContext[waQuestionId] = [];
    }

    accountContext[waQuestionId].push({
      wellArchitectedAnswerId: answer.id,
      customQuestionText: '',
      customAnswerText: answer.details,
      result: answer.override ? 'True' : 'False',
    });
  }

  return accountContext;
};

export default {
  parseWellArchitectedAnswers,
  mapAccountContextToWellArchitected,
  mapWellArchitectedAnalysisToAccountContext,
};
