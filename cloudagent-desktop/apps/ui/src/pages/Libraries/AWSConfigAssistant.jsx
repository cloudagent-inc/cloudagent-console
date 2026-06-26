/* eslint-disable */
import { Component, lazy, useLayoutEffect, useRef } from 'react';
import { withRouter, useLocation } from 'react-router-dom';
import { connect } from 'react-redux';
import React, { useState, useEffect } from 'react';
import Markdown from 'markdown-to-jsx';

import {
  Icon,
  Divider,
  Input,
  Radio,
  Form,
  Button,
  Select,
  Label,
  Container,
  Header,
  Message,
  Table,
  Popup,
  TextArea,
  Grid,
  Card,
  Menu,
  Segment,
  List,
  Dropdown,
  Modal,
  Tab,
  Checkbox,
  Pagination,
  Image,
  Accordion,
  Feed,
  Loader,
  Progress,
  Sidebar,
} from 'semantic-ui-react';
import get from 'lodash.get';

import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('yaml', yaml);

const ActionLoadingMessage = ({ loading, actionName }) => {
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((prevCount) => (prevCount === 3 ? 1 : prevCount + 1));
    }, 500); // Adjust the timing as needed

    return () => clearInterval(interval); // Clear interval on component unmount
  }, []);

  const renderDots = () => {
    return '.'.repeat(dotCount);
  };

  let message = '';
  if (actionName === 'aws_knoweldge_base')
    message = 'Looking up AWS knowledge base';
  else if (actionName === 'aws_environment_connector')
    message = 'Searching AWS environment details';
  else if (actionName === 'cli_documentation')
    message = 'Looking up AWS CLI documentation';
  else if (actionName === 'cfn_template')
    message = 'Looking up AWS CloudFormation documentation';
  else if (actionName === 'platform_help')
    message = 'Looking up platform documentation';
  else if (actionName === 'answer') return <></>;
  else if (actionName === 'execute_cli_command' || actionName === 'cli_session_command_execution')
    message = 'Running cloud CLI command';

  return (
    <div className="loading-list">
      <ul>
        <li>
          {loading ? <Loader active inline size="small" /> : <>asd</>}
          {message}
        </li>
      </ul>
    </div>
  );
};

const TerminalComponent = ({ commands }) => {
  const terminalRef = useRef(null);

  useEffect(() => {
    const terminalElement = terminalRef.current;

    const observer = new MutationObserver(() => {
      // Scroll to the bottom whenever the terminal's content changes
      terminalElement.scrollTop = terminalElement.scrollHeight;
    });

    // Observe changes to the child nodes (e.g., when new commands are added)
    observer.observe(terminalElement, { childList: true });

    // Clean up the observer when the component is unmounted
    return () => observer.disconnect();
  }, []);

  const terminalStyle = {
    backgroundColor: '#2b2b2b',
    color: '#f0f0f0',
    fontFamily: 'monospace',
    padding: '20px',
    borderRadius: '5px',
    width: '100%',
    maxHeight: '300px',
    overflowY: 'scroll',
    scrollbarColor: '#4caf50 #2b2b2b', // Changes scrollbar thumb and track colors
    scrollbarWidth: 'thin', // Optional: makes the scrollbar thinner
  };

  const terminalContainerStyle = {
    position: 'relative',
  };

  const commandLineStyle = {
    marginBottom: '10px',
    fontWeight: 'bold',
  };

  const promptStyle = {
    color: '#4caf50',
  };

  const commandStyle = {
    marginLeft: '10px',
    color: '#f0f0f0',
  };

  const outputStyle = {
    margin: '0 0 15px 20px',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    color: '#b0b0b0',
    fontStyle: 'italic',
    fontSize: '0.9em',
  };

  return (
    <div style={terminalContainerStyle}>
      <div style={terminalStyle} ref={terminalRef}>
        {commands.map((cmd, index) => (
          <React.Fragment key={index}>
            <div style={commandLineStyle}>
              <span style={promptStyle}>$</span>
              <span style={commandStyle}>{cmd.command}</span>
            </div>
            <pre style={outputStyle}>{cmd.output}</pre>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

class MyComponent extends Component {
  constructor(props) {
    super(props);
    this.state = this.initializeState(props.inputString);
  }

  initializeState(inputString) {
    const inputFieldRegex = /__input_field__(.*?)__input_field_end__/gs;
    let initialState = {
      activeFields: [],
    };

    let inputFieldMatches = [...inputString.matchAll(inputFieldRegex)];
    inputFieldMatches.forEach((match) => {
      const jsonContent = match[1].trim();
      try {
        const fieldProps = JSON.parse(jsonContent);
        const { label, fieldType } = fieldProps;
        const stateName = this.formatLabelToStateName(label);

        if (fieldType === 'radio_group') {
          initialState[stateName] = '';
        } else {
          initialState[stateName] = '';
        }
      } catch (error) {
        console.error('Invalid JSON:', jsonContent);
      }
    });

    return initialState;
  }

  formatLabelToStateName(label) {
    return label.replace(/\s+/g, '_').toLowerCase();
  }

  handleInputChange = (e, { name, value }) => {
    this.setState({ [name]: value });
    if (value !== '') {
      this.setState({
        activeFields: this.state.activeFields.concat([name]),
      });
    } else {
      this.setState({
        activeFields: this.state.activeFields.filter((f) => f !== name),
      });
    }
  };

  handleCheckboxChange = (e, { name, checked }) => {
    this.setState({
      activeFields: this.state.activeFields.concat([name]),
    });
    this.setState({ [name]: checked });
  };

  handleRadioChange = (e, { name, value }) => {
    this.setState({
      activeFields: this.state.activeFields.concat([name]),
    });
    this.setState({ [name]: value });
  };

  render() {
    const { inputString, mostRecentBlock } = this.props;

    if (!inputString || inputString.length === 0) return null;

    const inputFieldRegex = /__input_field__(.*?)__input_field_end__/gs;

    let lastIndex = 0;
    let finalOutput = [];

    let inputFieldMatches = [...inputString.matchAll(inputFieldRegex)];

    inputFieldMatches.forEach((match, matchIndex) => {
      finalOutput.push(
        <Markdown key={`before-input-${matchIndex}`}>
          {inputString.substring(lastIndex, match.index)}
        </Markdown>
      );

      const jsonContent = match[1].trim();
      let fieldProps;

      try {
        fieldProps = JSON.parse(jsonContent);
      } catch (error) {
        console.error('Invalid JSON:', jsonContent);
        finalOutput.push(
          <div key={`error-${matchIndex}`}>Invalid field configuration</div>
        );
        lastIndex = match.index + match[0].length;
        return;
      }

      const {
        fieldType,
        label,
        options,
        default_value,
        allow_multiple_selection,
      } = fieldProps;
      const stateName = this.formatLabelToStateName(label);

      let controlProps = {
        name: stateName,
        label,
        defaultValue: default_value,
        onChange: this.handleInputChange,
      };

      if (fieldType === 'checkbox') {
        controlProps = {
          ...controlProps,
          defaultChecked: default_value,
          onChange: this.handleCheckboxChange,
        };
      }

      if (fieldType === 'radio_group') {
        controlProps = {
          ...controlProps,
          onChange: this.handleRadioChange,
        };
      }

      let control;
      switch (fieldType) {
        case 'input':
          control = Input;
          break;
        case 'input_select':
          let optionsSelection = Array.isArray(options)
            ? options.map((option) => {
                return {
                  text: option['label'],
                  key: option['label'],
                  value: option['label'],
                };
              })
            : [];
          control = Select;
          controlProps.options = optionsSelection;
          controlProps.multiple = allow_multiple_selection;
          controlProps.search = true;
          break;
        case 'checkbox':
          control = Checkbox;
          controlProps.toggle = true;
          break;
        case 'radio_group':
          control = (
            <Form.Group key={`field-${matchIndex}`}>
              <label style={{ fontWeight: 'bold' }}>{label}</label>
              {options.map((option, index) => (
                <Form.Field
                  key={index}
                  control={Radio}
                  label={option.label}
                  name={stateName}
                  value={option.label}
                  checked={this.state[stateName] === option.label}
                  onChange={this.handleRadioChange}
                  style={{ fontSize: '18px', fontWeight: 'bold' }}
                />
              ))}
            </Form.Group>
          );
          break;
        default:
          control = Input;
          break;
      }

      if (fieldType !== 'radio_group') {
        finalOutput.push(
          <Form.Field
            inline
            key={`field-${matchIndex}`}
            control={control}
            {...controlProps}
            style={{ fontSize: '18px', fontWeight: 'bold' }}
          />
        );
      } else {
        finalOutput.push(control);
      }

      lastIndex = match.index + match[0].length;
    });

    finalOutput.push(
      <Markdown key="remaining-text">
        {inputString.substring(lastIndex)}
      </Markdown>
    );

    if (inputFieldMatches.length > 0 && mostRecentBlock)
      finalOutput.push(
        <div style={{ width: '100%', textAlign: 'center' }}>
          {' '}
          <Button
            primary
            onClick={() => {
              let answers = {};
              for (const key of Object.keys(this.state)) {
                if (this.state.activeFields.includes(key)) {
                  answers[key] = this.state[key];
                }
              }

              this.props.handleSubmitFormAnswers(JSON.stringify(answers));
            }}
            size="huge"
          >
            Submit Answers
          </Button>
        </div>
      );

    return inputFieldMatches.length > 0 ? (
      <Form style={{ fontSize: '18px' }}>{finalOutput}</Form>
    ) : (
      <div style={{ fontSize: '18px' }}>{finalOutput}</div>
    );
  }
}

const awsKbSearchExamples = [
  'What are some quotas or limits for EC2 that I should know about?',
  'How do I delegate administration for Access Analyzer?',
  'How many EC2 instances do i have?',
  'Are there any unencrypted resources in my account?',
  'Show me all IAM users',
  'Show me an example policy for restricting access to S3 buckets to VPC endpoints?',
  'How do I use AWS Backup for S3?',
  'How do I create a dedicated guardduty account to aggregate findings?',

  // 'What are the service limits for IAM? And which ones can be increased?',
  // 'What permissions do i need to start an ECS task',
  "What's the difference between creating a suppression rule vs. archiving findings in Inspector?",
];

class AWSConfigAssistant extends Component {
  constructor(props) {
    super(props);

    // let plan = iam_password_policy.slice();

    // for (const phase of plan) {
    // 	for (const task of phase.tasks) {
    // 		task.status = 'not-run';
    // 	}
    // }

    this.state = {
      plan: [],
      currentPhase: -1,
      currentTask: -1,
      autoContinue: false,
      showTerminal: true,
      terminalOutput: '',
      chatMessages: [],
      chatInput: '',
      finalOutput: '',

      queries: [],
      answers: [],
      loading: false,
      actions: [],
      cli_command_output: [],
      followupPrompt: '',
      sources: [],
      showConfigurationPlan: true,
      deploymentMethod: '',
    };
  }

  componentDidMount() {
    this.checkAutoContinue();
  }

  async componentWillMount() {
    const resp = await fetch(
      'https://agent-plans-sandbox/plans/plan_iam_password_policy.json'
    );

    let plan = await resp.json();
    for (const phase of plan) {
      for (const task of phase.tasks) {
        task.status = 'not-run';
      }
    }
    this.setState({ plan });
  }

  componentDidUpdate(prevProps, prevState) {
    if (
      this.state.autoContinue &&
      (prevState.currentPhase !== this.state.currentPhase ||
        prevState.currentTask !== this.state.currentTask ||
        prevState.plan !== this.state.plan)
    ) {
      this.checkAutoContinue();
    }
  }

  checkAutoContinue = () => {
    const { plan, currentPhase, currentTask, autoContinue } = this.state;
    if (
      autoContinue &&
      plan[currentPhase]?.tasks[currentTask]?.status === 'success'
    ) {
      this.selectNextTask();
    }
  };

  selectTask = (phaseIndex, taskIndex) => {
    this.setState({
      currentPhase: phaseIndex,
      currentTask: taskIndex,
      answers: [],
    });
  };

  selectNextTask = () => {
    const { currentPhase, currentTask, plan } = this.state;
    let nextPhase = currentPhase;
    let nextTask = currentTask + 1;

    if (nextTask >= plan[nextPhase].tasks.length) {
      nextPhase++;
      nextTask = 0;
    }

    if (nextPhase < plan.length) {
      this.selectTask(nextPhase, nextTask);
    } else {
      alert('All tasks completed!');
    }
  };

  executeTask = () => {
    const { plan, currentPhase, currentTask } = this.state;
    const newPlan = [...plan];

    let task = newPlan[currentPhase].tasks[currentTask];
    task.status = 'in-progress';
    this.setState({ plan: newPlan });

    let relevantOutput = {};
    // get relevant outputs from previous tasks
    for (const phase of newPlan) {
      for (const t of phase['tasks']) {
        const taskId = t['id'];
        const taskTitle = t['title'];
        const taskOutput = t['output'];
        if (task['includeOutput'].includes(taskId)) {
          relevantOutput[taskId] = `${taskTitle}:\n${taskOutput}`;
        }
      }
    }

    task['relevantOutput'] = relevantOutput;
    const index = this.state.queries.length;
    let updatedQueries = this.state.queries.slice();
    const query = `Execute Task Plan for: ${task['title']}`;
    updatedQueries[index] = query;
    this.streamData({
      answerIndex: index,
      query,
      url: 'https://54.208.178.66:3001/agent',
      task: {
        id: task.id,
        relevantOutput: task.relevantOutput,
        status: task.status,
      },
    });

    this.setState({
      queries: updatedQueries,
      followupPrompt: '',
      actions: [],
    });

    // setTimeout(() => {
    // 	task.status = 'success';
    // 	task.history.push(`Task executed at ${new Date().toLocaleString()}`);
    // 	this.setState((prevState) => ({
    // 		plan: newPlan,
    // 		finalOutput: prevState.finalOutput + `Completed: ${task.title}\n`,
    // 		terminalOutput:
    // 			prevState.terminalOutput +
    // 			`$ aws ${task.title.toLowerCase().replace(/ /g, '-')}\nTask '${
    // 				task.title
    // 			}' completed successfully.\n\n`,
    // 	}));
    // }, 2000);
  };

  handleInputChange = (e, { name, value }) => {
    this.setState({ [name]: value });
  };

  toggleAutoContinue = (e, { checked }) => {
    this.setState({ autoContinue: checked });
  };

  toggleTerminal = () => {
    this.setState((prevState) => ({ showTerminal: !prevState.showTerminal }));
  };

  startWorkflow = () => {
    this.streamData({
      answerIndex: 0,
      query:
        'Your current job is to guide the user with the configuring IAM password policy security in their environmnet. This will include reviewing their existing AWS account, gathering input from the user on how to build their backup configuraion and finally once all information is gathered, applying the configuration in their environment. Just reply with a message that you are ready to start. Do not request any information from the user at this point',
      url: 'https://54.208.178.66:3001/agent',
      task: null,
    });
    this.setState({
      currentPhase: 0,
      currentTask: 0,
    });
  };

  handleSubmitFormAnswers = (formAnswers) => {
    const query = this.state.followupPrompt;
    const index = this.state.queries.length;
    let updatedQueries = this.state.queries.slice();
    updatedQueries[index] = query;

    this.streamData({
      answerIndex: index,
      query: formAnswers,
      url: 'https://54.208.178.66:3001/agent',
      task: null,
    });
    this.setState({
      queries: updatedQueries,
      followupPrompt: '',
      actions: [],
      characterCount: 0,
    });
  };

  handleAgentChat = () => {
    const query = this.state.followupPrompt;
    const index = this.state.queries.length;
    let updatedQueries = this.state.queries.slice();
    updatedQueries[index] = query;

    this.streamData({
      answerIndex: index,
      query,
      url: 'https://54.208.178.66:3001/agent',
      task: null,
    });
    this.setState({
      queries: updatedQueries,
      followupPrompt: '',
      actions: [],
      characterCount: 0,
    });
  };

  streamData = async ({ query, url, task, answerIndex }) => {
    // const {userId} = this.props;
    let updatedAnswers = this.state.answers.slice();
    updatedAnswers[answerIndex] = '';
    this.setState({ loading: true, answers: updatedAnswers });

    // const query = this.state.queries[answerIndex];
    // let context = '';

    // if (answerIndex > 0) {
    // 	for (let i = 0; i < answerIndex; i++) {
    // 		context += `Question:\n${this.state.queries[i]}\nAnswer:\n${this.state.answers[i]}\n`;
    // 	}
    // }

    // let sources = this.state.sources.slice();
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        // labels,
        // sourceDocs,

        // chatHistory: context,
        // userId,
        // disableParaphrasing,
        // queryType,
        // userDetails,
        // queryContext,
        // isPublicSite: PUBLIC_SITE,
        task,
      }),
    })
      .then((response) => response.body)
      .then((stream) => {
        // callback1();
        const reader = stream.getReader();
        const read = async () => {
          const { done, value } = await reader.read();
          if (done) {
            // let updatedAnswers = this.state.answers.slice();

            // this.setState({loading: false, answers: updatedAnswers});

            this.setState({ loading: false });
            return;
          }
          const data = String.fromCharCode.apply(null, value);

          function extractAndParseJsonChunks(dataString) {
            const regex = /<<CHUNK_START>>(.*?)<<CHUNK_END>>/gs;
            let match;
            const jsonObjects = [];

            while ((match = regex.exec(dataString)) !== null) {
              try {
                const json = JSON.parse(match[1]);
                jsonObjects.push(json);
              } catch (e) {
                console.error('Error parsing JSON chunk:', e);
              }
            }

            return jsonObjects;
          }

          const chunks = extractAndParseJsonChunks(data);

          for (const chunk of chunks) {
            switch (chunk['type']) {
              case 'message_start':
                break;
              case 'action_start': {
                let actions = chunk['actions'];
                this.setState({ actions: actions.concat(this.state.actions) });
                break;
              }
              case 'action_end': {
                let actions = this.state.actions.slice();
                let actionIndex = actions.findIndex(
                  (a) => a['id'] === chunk['actionId']
                );

                if (actionIndex > -1) {
                  actions[actionIndex]['completed'] = true;
                }
                this.setState({ actions });
                break;
              }
              case 'message_in_progress': {
                let answers = this.state.answers.slice();
                answers[answerIndex] += chunk['content'];
                this.setState({ answers });
                break;
              }
              case 'task_status_update': {
                // let answers = this.state.answers.slice();
                // answers[answerIndex] += chunk['content'];
                // this.setState({answers});
                const taskStatus = JSON.parse(chunk['content']);

                const { plan, currentPhase, currentTask } = this.state;
                const newPlan = [...plan];

                let task = newPlan[currentPhase].tasks[currentTask];
                if (taskStatus['task_id'] === task.id) {
                  task.status = taskStatus['status'];
                  task.task_output = taskStatus['task_output_summary_message'];
                  this.setState({ plan: newPlan });
                }

                break;
              }
              case 'completed': {
                // let answers = this.state.answers.slice();
                // answers[answerIndex] += chunk['content'];
                // this.setState({answers});
                break;
              }
              case 'sources': {
                let sources = this.state.sources.slice();
                sources = sources.concat(chunk['sources']);
                this.setState({ sources });
                break;
              }
              case 'cli_command_output': {
                const { plan, currentPhase, currentTask } = this.state;
                const newPlan = [...plan];

                let task = newPlan[currentPhase].tasks[currentTask];
                if (!task.cli_command_output) task.cli_command_output = [];
                task.cli_command_output.push({
                  command: chunk['cli_command'],
                  output: chunk['cli_command_output'],
                });

                this.setState({ plan: newPlan });

                // let cli_command_output = this.state.cli_command_output.slice();
                // cli_command_output.push({
                // 	command: chunk['cli_command'],
                // 	output: chunk['cli_command_output'],
                // });

                // this.setState({cli_command_output});
                break;
              }

              case 'error':
                this.setState({ responseError: chunk['error_code'] });
                break;
            }
          }

          read();
        };
        read();
      })
      .catch((error) => {
        this.setState({ responseError: 'API_ERROR' });
        console.error('go error', error);
      });
  };

  render() {
    const {
      plan,
      currentPhase,
      currentTask,
      autoContinue,
      showTerminal,
      terminalOutput,
      chatMessages,
      chatInput,
      finalOutput,

      actions,
      answers,
      loading,
      followupPrompt,
      queries,
      showConfigurationPlan,
    } = this.state;

    const totalTasks = plan.reduce((sum, phase) => sum + phase.tasks.length, 0);
    const completedTasks = plan.reduce(
      (sum, phase) =>
        sum + phase.tasks.filter((task) => task.status === 'complete').length,
      0
    );

    const progress = (completedTasks / totalTasks) * 100;

    const cli_command_output = get(
      plan,
      [currentPhase, 'tasks', currentTask, 'cli_command_output'],
      []
    );

    return (
      <Container
        fluid
        style={{
          height: '100vh',
          padding: '20px',
          paddingTop: '60px',
        }}
      >
        <Grid>
          <Grid.Row columns={cli_command_output.length > 0 ? 3 : 2}>
            {showConfigurationPlan ? (
              <Grid.Column width={4}>
                <Header as="h2" style={{ fontSize: '24px' }}>
                  Configuration Plan{' '}
                  <Icon
                    link
                    style={{ float: 'right' }}
                    name="angle double left"
                    onClick={() =>
                      this.setState({ showConfigurationPlan: false })
                    }
                  />
                  {/* <Button
								basic
								onClick={() => this.setState({showConfigurationPlan: false})}
								content="<<"
								size="small"
								floated="right"
							/> */}
                  <Header.Subheader
                    style={{ paddingLeft: '8px', paddingRight: '8px' }}
                  >
                    <Progress percent={progress} color="blue">
                      Progress: {Math.round(progress)}%
                    </Progress>
                  </Header.Subheader>
                </Header>

                {plan.map((phase, phaseIndex) => (
                  <Segment basic key={phaseIndex}>
                    <Header as="h3">{phase.title}</Header>
                    <List selection>
                      {phase.tasks.map((task, taskIndex) => (
                        <List.Item
                          key={taskIndex}
                          onClick={() => this.selectTask(phaseIndex, taskIndex)}
                          active={
                            currentPhase === phaseIndex &&
                            currentTask === taskIndex
                          }
                        >
                          <List.Content>
                            <List.Header style={{ fontSize: '12px' }}>
                              <Icon
                                name={
                                  task.status === 'complete'
                                    ? 'check circle'
                                    : task.status === 'in_progress' ||
                                        task.status === 'waiting_on_user_input'
                                      ? 'circle notch'
                                      : 'circle outline'
                                }
                                color={
                                  task.status === 'complete'
                                    ? 'blue'
                                    : task.status === 'in_progress' ||
                                        task.status === 'waiting_on_user_input'
                                      ? 'yellow'
                                      : 'grey'
                                }
                                loading={
                                  task.status === 'in_progress' ||
                                  task.status === 'waiting_on_user_input'
                                }
                              />
                              {task.title}
                              {task['task_output'] ? (
                                <Modal
                                  header="Task Output"
                                  content={
                                    <div style={{ whiteSpace: 'pre-wrap' }}>
                                      {task['task_output']}
                                    </div>
                                  }
                                  trigger={
                                    <span style={{ float: 'right' }}>
                                      <Icon name="clipboard" />
                                    </span>
                                  }
                                  size="large"
                                  dimmer="inverted"
                                />
                              ) : null}
                              {get(task, 'cli_command_output', []).length >
                              0 ? (
                                <Modal
                                  content={
                                    <TerminalComponent
                                      commands={task['cli_command_output']}
                                    />
                                  }
                                  trigger={
                                    <span style={{ float: 'right' }}>
                                      <Icon name="terminal" />
                                    </span>
                                  }
                                  size="large"
                                  dimmer="inverted"
                                />
                              ) : null}
                            </List.Header>

                            {/* {currentPhase === phaseIndex &&
												currentTask === taskIndex &&
												plan[currentPhase]?.tasks[currentTask]?.status ===
													'not-run' ? (
													<>
														<br />
														<List.Description
															style={{
																textAlign: 'center',
															}}
														>
															<Button
																primary
																fluid
																size="large"
																onClick={this.executeTask}
															>
																<Icon name="play" />
																Execute Task
															</Button>
														</List.Description>
													</>
												) : null} */}
                          </List.Content>
                        </List.Item>
                      ))}
                    </List>
                  </Segment>
                ))}
              </Grid.Column>
            ) : null}

            <Grid.Column
              width={
                cli_command_output.length > 0
                  ? showConfigurationPlan
                    ? 6
                    : 10
                  : 12
              }
            >
              {!showConfigurationPlan ? (
                <Button
                  onClick={() => this.setState({ showConfigurationPlan: true })}
                >
                  Show Configuration Plan
                </Button>
              ) : null}
              {currentPhase < 0 ? (
                <div style={{ textAlign: 'center', width: '100%' }}>
                  <Button
                    size="massive"
                    color="blue"
                    onClick={this.startWorkflow}
                  >
                    Connect to Agent
                  </Button>
                </div>
              ) : null}
              {currentPhase >= 0 ? (
                <>
                  <Segment
                    basic
                    style={{ backgroundColor: '#f3f4f6', width: '100%' }}
                  >
                    <Header as="h3" style={{ fontSize: '20px' }}>
                      Current Task:{' '}
                      {plan[currentPhase]?.tasks[currentTask]?.title}
                      <div style={{ float: 'right', fontWeight: '500' }}>
                        {loading ? <Icon name="circle notch" loading /> : null}
                        {plan[currentPhase]?.tasks[currentTask]?.status ===
                        'complete' ? (
                          <>
                            <Icon name="check circle" />
                            Task Completed
                          </>
                        ) : null}
                        {plan[currentPhase]?.tasks[currentTask]?.status ===
                        'not-run' ? (
                          <>
                            <Label basic color="white" size="large">
                              Not Started
                            </Label>
                            <br />
                            <br />
                          </>
                        ) : null}
                      </div>
                    </Header>

                    <p style={{ fontSize: '16px' }}>
                      {plan[currentPhase]?.tasks[currentTask]?.description}
                    </p>
                    <Markdown
                      style={{ fontSize: '16px' }}
                      options={{
                        overrides: {
                          a: {
                            props: {
                              target: '_blank',
                            },
                          },
                          code: {
                            props: {
                              style: { whiteSpace: 'pre-line' },
                            },
                          },
                        },
                      }}
                    >
                      {(() => {
                        const task = plan[currentPhase]?.tasks[currentTask];
                        const userExplanation = task?.userExplanation;
                        const description = task?.description;
                        const explanation = Array.isArray(userExplanation) && userExplanation.length > 0
                          ? userExplanation.join('\n')
                          : (Array.isArray(description) && description.length > 0
                            ? description.join('\n')
                            : description || '');
                        return explanation;
                      })()}
                    </Markdown>

                    {plan[currentPhase]?.tasks[currentTask]?.type ===
                    'automatic_write' ? (
                      this.state.deploymentMethod !== '' ? null : (
                        <Segment style={{ textAlign: 'center' }}>
                          <Header as="h2" textAlign="center">
                            Select Deployment Method
                          </Header>
                          <Button
                            onClick={() =>
                              this.setState({ deploymentMethod: 'cli' })
                            }
                            size="huge"
                            primary
                          >
                            AWS CLI (Write Access Required)
                          </Button>
                          <Button
                            onClick={() =>
                              this.setState({
                                deploymentMethod: 'cloudformation',
                              })
                            }
                            size="huge"
                            primary
                          >
                            AWS CloudFormation (No Access Required)
                          </Button>
                          <Button
                            onClick={() =>
                              this.setState({ deploymentMethod: 'terraform' })
                            }
                            size="huge"
                            primary
                          >
                            Terraform (No Access Required)
                          </Button>
                        </Segment>
                      )
                    ) : null}
                    {plan[currentPhase]?.tasks[currentTask]?.status ===
                    'complete' ? (
                      <Button
                        size="huge"
                        floated="right"
                        primary
                        onClick={() => {
                          if (
                            currentPhase === plan.length - 1 &&
                            currentTask === plan[currentPhase].tasks.length - 1
                          )
                            return;
                          if (
                            currentTask ===
                            plan[currentPhase].tasks.length - 1
                          )
                            this.selectTask(currentPhase + 1, 0);
                          else this.selectTask(currentPhase, currentTask + 1);
                        }}
                      >
                        Next Task
                        <Icon name="chevron right" />
                      </Button>
                    ) : null}
                    {plan[currentPhase]?.tasks[currentTask]?.status ===
                    'not-run' ? (
                      <Button
                        primary
                        size="huge"
                        floated="right"
                        onClick={this.executeTask}
                      >
                        <Icon name="play" />
                        Start Task
                      </Button>
                    ) : null}

                    {/* {plan[currentPhase]?.tasks[currentTask]?.status ===
											'complete' ? (
												<Button size="huge" floated="right">
													<Icon name="redo" /> Redo Task
												</Button>
											) : null} */}

                    <br />
                    <br />

                    <Segment
                      style={{ maxHeight: '500px', overflowY: 'scroll' }}
                    >
                      {answers.map((answer, index) => (
                        <>
                          <div
                            key={index}
                            style={{
                              overflowWrap: 'break-word',
                              whiteSpace: 'pre-line',
                              marginBottom:
                                index === answers.length - 1 ? '40px' : '10px',
                            }}
                            className="results-row"
                          >
                            <div
                              className="child-question"
                              style={{
                                backgroundColor: '#0000001A',
                                textAlign: 'right',
                              }}
                            >
                              <h2>{queries[index]}</h2>
                            </div>
                            {index <= answers.length - 1 ? (
                              <div>
                                {loading &&
                                actions.length > 0 &&
                                actions.every((a) => a['completed']) ? (
                                  <ActionLoadingMessage
                                    actionName="answer"
                                    loading={loading}
                                  />
                                ) : null}
                                <>
                                  <MyComponent
                                    inputString={answer}
                                    resourceTables={null}
                                    syncTemplate={this.syncTemplate}
                                    history={this.props.history}
                                    handleSubmitFormAnswers={
                                      this.handleSubmitFormAnswers
                                    }
                                    mostRecentBlock={
                                      index === answers.length - 1
                                    }
                                  />
                                </>
                              </div>
                            ) : null}
                          </div>
                        </>
                      ))}
                    </Segment>
                    {loading ? null : (
                      <Segment>
                        <div className="ask-question-btn">
                          <Form>
                            <Form.Group>
                              <Input
                                name="followupPrompt"
                                value={followupPrompt}
                                size="massive"
                                style={{ width: '100%' }}
                                icon="chevron right"
                                focus
                                fluid
                                placeholder="Chat with Agent..."
                                onChange={this.handleInputChange}
                                onKeyDown={(e) => {
                                  if (e.keyCode === 13) this.handleAgentChat();
                                }}
                                disabled={
                                  plan[currentPhase]?.tasks[currentTask]
                                    ?.status === 'not-run'
                                }
                              />
                            </Form.Group>
                          </Form>
                        </div>
                      </Segment>
                    )}
                  </Segment>
                </>
              ) : null}
            </Grid.Column>
            {cli_command_output.length > 0 ? (
              <Grid.Column width={showConfigurationPlan ? 6 : 4}>
                <Button.Group>
                  {cli_command_output.length > 0 ? (
                    <Button
                      icon
                      labelPosition="left"
                      onClick={this.toggleTerminal}
                      size="huge"
                    >
                      <Icon name="terminal" />
                      {showTerminal ? 'Hide' : 'Show'} Terminal
                    </Button>
                  ) : null}
                </Button.Group>

                {cli_command_output.length > 0 && showTerminal && (
                  <Segment basic>
                    <TerminalComponent commands={cli_command_output} />
                  </Segment>
                )}
              </Grid.Column>
            ) : null}
          </Grid.Row>
        </Grid>

        {/* </Grid.Column> */}
        {/* </Grid> */}
      </Container>
    );
  }
}
function mapStateToProps({ userSession, authSession }) {
  return {
    userSession: userSession || {
      userProfile: {
        assessmentResults: {},
        subscription: {},
      },
    },
    authSession,
  };
}

// export default connect(mapStateToProps)(withRouter(CloudAdvisor));
export default connect(mapStateToProps)(withRouter(AWSConfigAssistant));
