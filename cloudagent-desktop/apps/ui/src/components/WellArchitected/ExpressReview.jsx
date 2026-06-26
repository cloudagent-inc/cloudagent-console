import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Info,
  Loader2,
  Settings,
  Flag,
  MinusCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Edit2 } from 'lucide-react';
import waMapping from '@/helpers/wellarchitected/wellArchitectedCustomQuestions';

const ExpressReview = ({ answers, setAnswers, assessmentNotes, setAssessmentNotes, answerValues, setAnswerValues, choiceContexts, setChoiceContexts }) => {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [loadingAnswer, setLoadingAnswer] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Settings state
  const [autoApplyAnswers, setAutoApplyAnswers] = useState(true);
  const [autoCopyNotes, setAutoCopyNotes] = useState(true);
  const [autoSaveAnswers, setAutoSaveAnswers] = useState(true);

  // Initialize groups
  useEffect(() => {
    const uniqueGroups = [];
    for (const questionId of Object.keys(waMapping)) {
      if (!uniqueGroups.includes(waMapping[questionId].group)) {
        uniqueGroups.push(waMapping[questionId].group);
      }
    }
    setGroups(uniqueGroups);
    setSelectedGroup(uniqueGroups[0] || '');
  }, []);

  // Initialize answer values only if empty (preserves state between view switches)
  useEffect(() => {
    // Only initialize if answerValues is empty (first mount or not yet initialized)
    if (!answerValues || Object.keys(answerValues).length === 0) {
      const initialAnswers = {};
      for (const questionId of Object.keys(waMapping)) {
        initialAnswers[questionId] = {
          answer: '',
          analysis: [],
          yesToAll: false,
          noToAll: false,
          notApplicable: false,
        };
      }
      setAnswerValues(initialAnswers);
    }
  }, [answerValues, setAnswerValues]);

  // Sync answerValues to shared answers state (Default View) and choiceContexts (suggestions)
  const syncToDefaultView = (analysisItems) => {
    if (!setAnswers) return;

    const newAnswers = { ...answers };
    const newNotes = { ...(assessmentNotes || {}) };
    const newChoiceContexts = { ...(choiceContexts || {}) };

    for (const item of analysisItems) {
      const { id: choiceId, waQuestionId, result, override, details } = item;
      if (!waQuestionId) continue;

      // Initialize the answer array for this WA question if needed
      if (!newAnswers[waQuestionId]) {
        newAnswers[waQuestionId] = [];
      }

      if (result === 'True' && override) {
        // Add the choice to selected answers if not already there
        if (!newAnswers[waQuestionId].includes(choiceId)) {
          newAnswers[waQuestionId] = [...newAnswers[waQuestionId], choiceId];
        }
        // Remove "None of these" choice if present
        newAnswers[waQuestionId] = newAnswers[waQuestionId].filter(
          (id) => !id.toLowerCase().includes('_no')
        );
      } else if (result === 'False' || result === 'Not Applicable') {
        // Remove the choice from selected answers
        newAnswers[waQuestionId] = newAnswers[waQuestionId].filter(
          (id) => id !== choiceId
        );
      }

      // Update choiceContexts.accountContext for this choice (for suggestion counts)
      const contextKey = `${waQuestionId}.${choiceId}`;
      if (!newChoiceContexts[contextKey]) {
        newChoiceContexts[contextKey] = {
          passed: [],
          failed: [],
          notapplicable: [],
          accountContext: [],
        };
      }

      // Find existing accountContext entry for this choice or create new
      const existingIndex = newChoiceContexts[contextKey].accountContext?.findIndex(
        (ac) => ac.wellArchitectedAnswerId === choiceId
      );

      const accountContextEntry = {
        wellArchitectedAnswerId: choiceId,
        customQuestionText: '',
        customAnswerText: details || (result === 'True' ? 'Marked as true' : result === 'False' ? 'Marked as false' : 'Not applicable'),
        result: result,
      };

      if (existingIndex > -1) {
        // Update existing entry
        newChoiceContexts[contextKey].accountContext[existingIndex] = accountContextEntry;
      } else {
        // Add new entry
        newChoiceContexts[contextKey].accountContext.push(accountContextEntry);
      }

      // Build notes for the question if autoCopyNotes is enabled
      if (autoCopyNotes && details && setAssessmentNotes) {
        const waQuestion = waMapping[Object.keys(waMapping).find(
          (qId) => waMapping[qId].waQuestions?.[choiceId]
        )];
        const choiceInfo = waQuestion?.waQuestions?.[choiceId];
        if (choiceInfo) {
          const notePrefix = `# ${choiceInfo.waChoiceText}\n`;
          const noteContent = `- ${details}\n`;
          if (!newNotes[waQuestionId]) {
            newNotes[waQuestionId] = '';
          }
          if (!newNotes[waQuestionId].includes(noteContent)) {
            newNotes[waQuestionId] += notePrefix + noteContent + '\n';
          }
        }
      }
    }

    setAnswers(newAnswers);
    if (setAssessmentNotes && Object.keys(newNotes).length > 0) {
      setAssessmentNotes(newNotes);
    }
    if (setChoiceContexts) {
      setChoiceContexts(newChoiceContexts);
    }
  };

  // Handle Yes to All / No to All / Not Applicable
  const handleOptionChange = (questionId, field) => {
    const currentValue = answerValues[questionId]?.[field] || false;
    const newValue = !currentValue;

    let analysis = [];
    if (newValue) {
      const { waQuestions } = waMapping[questionId];

      for (const choiceId of Object.keys(waQuestions || {})) {
        const { waQuestionId, defaultTrueText, defaultFalseText } = waQuestions[choiceId];
        analysis.push({
          id: choiceId,
          result:
            field === 'yesToAll'
              ? 'True'
              : field === 'noToAll'
              ? 'False'
              : 'Not Applicable',
          details:
            field === 'yesToAll'
              ? defaultTrueText || 'Marked as true'
              : field === 'noToAll'
              ? defaultFalseText || 'Marked as false'
              : 'Not applicable',
          waQuestionId,
          override: field === 'yesToAll',
        });
      }
    }

    setAnswerValues((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        yesToAll: field === 'yesToAll' ? newValue : false,
        noToAll: field === 'noToAll' ? newValue : false,
        notApplicable: field === 'notApplicable' ? newValue : false,
        answer: '',
        analysis: analysis,
      },
    }));

    // Sync to Default View if autoApplyAnswers is enabled
    if (autoApplyAnswers && analysis.length > 0) {
      syncToDefaultView(analysis);
    }
  };

  const handleNotesChange = (questionId, value) => {
    // When typing notes, clear any existing analysis and options (like asecurecloud)
    setAnswerValues((prev) => ({
      ...prev,
      [questionId]: {
        answer: value,
        analysis: [], // Clear analysis when typing notes
        yesToAll: false,
        noToAll: false,
        notApplicable: false,
      },
    }));
  };

  const handleReset = (questionId) => {
    setAnswerValues((prev) => ({
      ...prev,
      [questionId]: {
        answer: '',
        analysis: [],
        yesToAll: false,
        noToAll: false,
        notApplicable: false,
      },
    }));
  };

  const handleOverrideChange = (questionId, choiceIndex, checked) => {
    let updatedAnalysis = [];
    setAnswerValues((prev) => {
      const newAnalysis = [...(prev[questionId]?.analysis || [])];
      if (newAnalysis[choiceIndex]) {
        newAnalysis[choiceIndex] = {
          ...newAnalysis[choiceIndex],
          override: checked,
        };
      }
      updatedAnalysis = newAnalysis;
      return {
        ...prev,
        [questionId]: {
          ...prev[questionId],
          analysis: newAnalysis,
        },
      };
    });

    // Sync to Default View if autoApplyAnswers is enabled
    if (autoApplyAnswers && updatedAnalysis.length > 0) {
      // Use setTimeout to ensure state is updated first
      setTimeout(() => syncToDefaultView(updatedAnalysis), 0);
    }
  };

  const handleDetailsChange = (questionId, choiceId, newDetails) => {
    setAnswerValues((prev) => {
      const newAnalysis = [...(prev[questionId]?.analysis || [])];
      const choiceIndex = newAnalysis.findIndex((a) => a.id === choiceId);
      if (choiceIndex > -1) {
        newAnalysis[choiceIndex] = {
          ...newAnalysis[choiceIndex],
          details: newDetails,
        };
      }
      return {
        ...prev,
        [questionId]: {
          ...prev[questionId],
          analysis: newAnalysis,
        },
      };
    });
  };

  const handleAnalyzeNotes = async (questionId) => {
    const currentAnswer = answerValues[questionId];

    // Validation
    if (!currentAnswer?.answer || currentAnswer?.analysis?.length > 0) {
      return;
    }

    setLoadingAnswer([questionId]);

    const { question, waQuestions } = waMapping[questionId];

    // Build mapping string
    let mapping = '';
    for (const choiceId of Object.keys(waQuestions || {})) {
      mapping += `${choiceId}: ${waQuestions[choiceId]['condition']}\n`;
    }

    const data = {
      questionId,
      answer: currentAnswer.answer,
      question,
      mapping,
    };

    try {
      const response = await fetch('https://cloudadvisor-beta.asecure.cloud/processQuestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.status === 200 && result.result?.[questionId]) {
        const analysisResults = result.result[questionId].map((answer) => ({
          ...answer,
          override: answer.result === 'True',
          waQuestionId: waMapping[questionId]?.waQuestions?.[answer.id]?.waQuestionId || '',
        }));

        setAnswerValues((prev) => ({
          ...prev,
          [questionId]: {
            ...prev[questionId],
            analysis: analysisResults,
          },
        }));

        // Sync to Default View if autoApplyAnswers is enabled
        if (autoApplyAnswers && analysisResults.length > 0) {
          syncToDefaultView(analysisResults);
        }
      }
    } catch (error) {
      console.error('Error analyzing notes:', error);
    } finally {
      setLoadingAnswer([]);
    }
  };

  const getAnalysisCounts = (questionId) => {
    const analysis = answerValues[questionId]?.analysis || [];
    return {
      passed: analysis.filter((a) => a.result === 'True' && a.override).length,
      failed: analysis.filter((a) => a.result === 'False' || (a.result === 'True' && !a.override)).length,
      total: Object.keys(waMapping[questionId]?.waQuestions || {}).length,
    };
  };

  return (
    <div className="space-y-6">
      {/* Group Tabs */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div className="flex flex-wrap gap-2">
          {groups.map((group) => (
            <button
              key={group}
              onClick={() => setSelectedGroup(group)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                selectedGroup === group
                  ? 'bg-primary-100 text-primary-700 border border-primary-600'
                  : 'text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {group}
            </button>
          ))}
        </div>

        {/* Settings Button */}
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white max-w-md">
            <DialogHeader>
              <DialogTitle>Settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <Label>Auto apply answers</Label>
                <Switch
                  checked={autoApplyAnswers}
                  onCheckedChange={setAutoApplyAnswers}
                  className="data-[state=checked]:bg-primary-600"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Auto copy notes</Label>
                <Switch
                  checked={autoCopyNotes}
                  onCheckedChange={setAutoCopyNotes}
                  disabled={!autoApplyAnswers}
                  className="data-[state=checked]:bg-primary-600"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Auto save answers for future workloads</Label>
                <Switch
                  checked={autoSaveAnswers}
                  onCheckedChange={setAutoSaveAnswers}
                  className="data-[state=checked]:bg-primary-600"
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Questions */}
      <div className="space-y-6">
        {Object.keys(waMapping)
          .filter((questionId) => waMapping[questionId].group === selectedGroup)
          .map((questionId) => {
            const question = waMapping[questionId];
            const currentAnswer = answerValues[questionId] || {};
            const { passed, failed, total } = getAnalysisCounts(questionId);
            const hasAnalysis = (currentAnswer.analysis || []).length > 0;

            return (
              <div
                key={questionId}
                className="bg-white border border-gray-200 rounded-xl p-6 space-y-4"
              >
                {/* Question Header */}
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {question.title}
                  </h3>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleReset(questionId)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-full hover:bg-gray-50"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Reset
                    </button>
                    <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-600 border border-gray-200 rounded-full">
                      <CheckCircle2 className="h-4 w-4" />
                      {passed} Passed
                    </span>
                    <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-gray-200 rounded-full">
                      <XCircle className="h-4 w-4" />
                      {failed} Failed
                    </span>
                    {/* Details Modal */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-full hover:bg-gray-50">
                          <Info className="h-4 w-4" />
                          Details
                        </button>
                      </DialogTrigger>
                      <DialogContent className="bg-white max-w-5xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Mapping Details</DialogTitle>
                        </DialogHeader>
                        <div className="mt-4 overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-gray-50">
                                <th className="text-left py-3 px-3 font-medium text-gray-600 w-12">Actions</th>
                                <th className="text-left py-3 px-3 font-medium text-gray-600">WA Question</th>
                                <th className="text-left py-3 px-3 font-medium text-gray-600">WA Choice</th>
                                <th className="text-left py-3 px-3 font-medium text-gray-600">Details</th>
                                <th className="text-left py-3 px-3 font-medium text-gray-600 w-24">Result</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600 w-20">Override</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.keys(question.waQuestions || {}).map((choiceId, index) => {
                                const choice = question.waQuestions[choiceId];
                                const analysisItem = (currentAnswer.analysis || []).find(a => a.id === choiceId);
                                const result = analysisItem?.result || '';
                                const details = analysisItem?.details || '';
                                const override = analysisItem?.override || false;

                                return (
                                  <tr key={choiceId} className="border-b hover:bg-gray-50">
                                    <td className="py-3 px-3">
                                      <Flag className="h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600" />
                                    </td>
                                    <td className="py-3 px-3 text-gray-700">{choice.waQuestionText}</td>
                                    <td className="py-3 px-3 text-gray-700">{choice.waChoiceText}</td>
                                    <td className="py-3 px-3">
                                      <div className="flex items-center gap-2">
                                        <span className="text-gray-500">{details || '-'}</span>
                                        {analysisItem && (
                                          <Popover>
                                            <PopoverTrigger asChild>
                                              <button className="p-1 hover:bg-gray-100 rounded">
                                                <Edit2 className="h-4 w-4 text-gray-400" />
                                              </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-80 p-3" align="start">
                                              <Textarea
                                                value={details}
                                                onChange={(e) => handleDetailsChange(questionId, choiceId, e.target.value)}
                                                rows={4}
                                                placeholder="Enter details..."
                                                className="w-full"
                                              />
                                            </PopoverContent>
                                          </Popover>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-3 px-3">
                                      {result === 'True' ? (
                                        <span className="flex items-center gap-1 text-green-600">
                                          <CheckCircle2 className="h-4 w-4" />
                                          Passed
                                        </span>
                                      ) : result === 'False' ? (
                                        <span className="flex items-center gap-1 text-red-600">
                                          <XCircle className="h-4 w-4" />
                                          Failed
                                        </span>
                                      ) : result === 'Not Applicable' ? (
                                        <span className="flex items-center gap-1 text-gray-500">
                                          <MinusCircle className="h-4 w-4" />
                                          N/A
                                        </span>
                                      ) : (
                                        <span className="text-gray-400">-</span>
                                      )}
                                    </td>
                                    <td className="py-3 px-3 text-center">
                                      <Checkbox
                                        checked={override}
                                        onCheckedChange={(checked) => handleOverrideChange(questionId, index, checked)}
                                        disabled={!analysisItem}
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button
                      onClick={() => handleAnalyzeNotes(questionId)}
                      disabled={
                        !currentAnswer.answer ||
                        hasAnalysis ||
                        loadingAnswer.includes(questionId)
                      }
                      size="sm"
                    >
                      {loadingAnswer.includes(questionId) ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Analyzing
                        </>
                      ) : (
                        'Analyze Notes'
                      )}
                    </Button>
                  </div>
                </div>

                {/* Question Text */}
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {question.question}
                </p>

                {/* Options - Yes to All, No to All, Not Applicable */}
                <div className="flex items-center gap-6">
                  <label
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => handleOptionChange(questionId, 'yesToAll')}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        currentAnswer.yesToAll
                          ? 'border-primary-600 bg-primary-600'
                          : 'border-gray-300'
                      }`}
                    >
                      {currentAnswer.yesToAll && (
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      )}
                    </div>
                    <span className="text-sm text-gray-700">Yes to All</span>
                  </label>

                  <label
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => handleOptionChange(questionId, 'noToAll')}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        currentAnswer.noToAll
                          ? 'border-primary-600 bg-primary-600'
                          : 'border-gray-300'
                      }`}
                    >
                      {currentAnswer.noToAll && (
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      )}
                    </div>
                    <span className="text-sm text-gray-700">No to All</span>
                  </label>

                  <label
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => handleOptionChange(questionId, 'notApplicable')}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        currentAnswer.notApplicable
                          ? 'border-primary-600 bg-primary-600'
                          : 'border-gray-300'
                      }`}
                    >
                      {currentAnswer.notApplicable && (
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      )}
                    </div>
                    <span className="text-sm text-gray-700">Not Applicable</span>
                  </label>
                </div>

                {/* Notes */}
                {!question.disableAnalysis && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Notes</Label>
                    <Textarea
                      value={currentAnswer.answer || ''}
                      onChange={(e) => handleNotesChange(questionId, e.target.value)}
                      placeholder={
                        question.examples?.length > 0
                          ? `Examples:\n\n${question.examples.join('\n')}`
                          : 'Enter your notes here...'
                      }
                      rows={4}
                      className="resize-none"
                    />
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default ExpressReview;
