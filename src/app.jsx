
import { useState } from 'react'
import {
  Check, Sparkles, Clock3, MapPin, Trash2,
  Plus, ArrowRight, RotateCcw, ListTodo,
  WandSparkles, CircleCheck, Pencil
} from 'lucide-react'
import './style.css'

const sample = 'I want to study at NUS for 2 hours, eat at Haidilao, and buy groceries before 6pm. Studying is my highest priority.'

function App() {
  const [input, setInput] = useState('')
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const parseTasks = async () => {
    if (!input.trim()) return

    setLoading(true)
    setError('')
    setConfirmed(false)
    setTasks([])

    const API_URL = import.meta.env.VITE_API_URL;
    try {
      const response = await fetch(`${API_URL}/parse-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input }),
      })

      //const data = await response.json()
      const raw = await response.text()
      console.log('API status:', response.status)
      console.log('API response:', raw)

      const data = JSON.parse(raw)
      if (!response.ok) {
        throw new Error(data.detail || 'Unable to parse tasks.')
      }

      setTasks((data.tasks || []).map((task, index) => ({
        ...task,
        id: `${Date.now()}-${index}`,
      })))
    } catch (err) {
      setError(err.message || 'Could not connect to the parser.')
    } finally {
      setLoading(false)
    }
  }

  const updateTask = (id, field, value) => {
    setTasks(current => current.map(task =>
      task.id === id ? { ...task, [field]: value } : task
    ))
    setConfirmed(false)
  }

  const removeTask = id => {
    setTasks(current => current.filter(task => task.id !== id))
    setConfirmed(false)
  }

  const reset = () => {
    setInput('')
    setTasks([])
    setError('')
    setConfirmed(false)
  }

  const totalMinutes = tasks.reduce(
    (sum, task) => sum + (Number(task.duration_minutes) || 0), 0
  )

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brandmark"><Check size={19}/></div>
          <span>Timely</span>
          <span className="beta">AI LAB</span>
        </div>
        <div className="header-tag">
          <span className="status-dot"/> Parser online
        </div>
      </header>

      <main>
        <section className="hero">
          <div>
            <div className="eyebrow">
              <Sparkles size={14}/> YOUR PLANS, MADE ACTIONABLE
            </div>
            <h1>From thoughts<br/>
              <em>to tasks.</em>
            </h1>
            <p>Tell us what's on your mind. Let AI organise your day.</p>
          </div>

          <div className="hero-art">
            <div className="hero-orbit orbit-one"/>
            <div className="hero-orbit orbit-two"/>
            <div className="hero-icon">
              <WandSparkles size={38}/>
            </div>
            <div className="floating-note">
              <Check size={15}/>
              <span>Plans, organised.</span>
            </div>
          </div>
        </section>

        <div className="steps">
          <div className="current"><span>01</span> Describe</div>
          <i/>
          <div className={tasks.length ? 'current' : ''}>
            <span>02</span> Review
          </div>
          <i/>
          <div className={confirmed ? 'current' : ''}>
            <span>03</span> Confirm
          </div>
        </div>

        <section className="workspace">
          <div className="section-heading">
            <div>
              <div className="eyebrow">STEP 01 · NATURAL LANGUAGE INPUT</div>
              <h2>What's on your mind?</h2>
              <p>Describe your activities, places and deadlines in your own words.</p>
            </div>
            <div className="ai-pill">
              <Sparkles size={14}/> AI powered
            </div>
          </div>

          <div className="input-panel">
            <div className="panel-top">
              <ListTodo size={19}/>
              <b>Describe your day</b>
              <span>Write naturally</span>
            </div>

            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="e.g. I need to study at NUS for two hours, grab lunch at a cafe, and buy groceries before 6pm..."
              rows={5}
            />

            <div className="input-footer">
              <button
                className="sample-btn"
                onClick={() => setInput(sample)}
              >
                Try an example
              </button>
              <span>{input.length} characters</span>
            </div>

            <button
              className="primary-btn full"
              onClick={parseTasks}
              disabled={loading || !input.trim()}
            >
              {loading
                ? <> <span className="spinner"/> Parsing your plans...</>
                : <> <WandSparkles size={17}/> Parse my tasks <ArrowRight size={17}/></>
              }
            </button>
          </div>

          {error && <div className="error">{error}</div>}

          {tasks.length > 0 && (
            <div className="results">
              <div className="section-heading result-heading">
                <div>
                  <div className="eyebrow">STEP 02 · REVIEW YOUR TASKS</div>
                  <h2>Here's what I got.</h2>
                  <p>Check the details and make any changes before confirming.</p>
                </div>
                <span className="count-pill">
                  {tasks.length} tasks found
                </span>
              </div>

              <div className="task-list">
                {tasks.map((task, index) => (
                  <div className="task-card" key={task.id}>
                    <div className="task-number">{String(index + 1).padStart(2, '0')}</div>

                    <div className="task-fields">
                      <label>
                        Task
                        <input
                          value={task.title}
                          onChange={e => updateTask(task.id, 'title', e.target.value)}
                        />
                      </label>

                      <label>
                        Venue
                        <div className="field-icon">
                          <MapPin size={15}/>
                          <input
                            value={task.venue || ''}
                            placeholder="Add a venue"
                            onChange={e => updateTask(task.id, 'venue', e.target.value)}
                          />
                        </div>
                      </label>

                      <div className="field-row">
                        <label>
                          Duration (minutes)
                          <input
                            type="number"
                            min="1"
                            value={task.duration_minutes}
                            onChange={e => updateTask(task.id, 'duration_minutes', e.target.value)}
                          />
                        </label>

                        <label>
                          Priority
                          <select
                            value={task.priority}
                            onChange={e => updateTask(task.id, 'priority', e.target.value)}
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </label>
                      </div>

                      <label>
                        Deadline
                        <input
                          type="text"
                          placeholder="No deadline"
                          value={task.deadline || ''}
                          onChange={e => updateTask(task.id, 'deadline', e.target.value)}
                        />
                      </label>
                    </div>

                    <button
                      className="icon-btn"
                      onClick={() => removeTask(task.id)}
                      aria-label="Remove task"
                    >
                      <Trash2 size={17}/>
                    </button>
                  </div>
                ))}
              </div>

              <div className="summary">
                <div>
                  <b>{tasks.length} activities extracted</b>
                  <span><Clock3 size={14}/> {totalMinutes} minutes estimated</span>
                </div>
                <button className="text-btn" onClick={reset}>
                  <RotateCcw size={15}/> Start over
                </button>
              </div>

              <div className="bottom-action">
                <div>
                  <b>Everything look right?</b>
                  <span>Confirm your reviewed tasks.</span>
                </div>
                <button
                  className="primary-btn"
                  onClick={() => setConfirmed(true)}
                  disabled={!tasks.length || tasks.some(t => !t.title.trim())}
                >
                  <Check size={17}/> Confirm tasks
                </button>
              </div>

              {confirmed && (
                <div className="success">
                  <CircleCheck size={20}/>
                  <div>
                    <b>Tasks confirmed!</b>
                    <span>Your reviewed tasks are ready for the next step.</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {tasks.length === 0 && !loading && (
            <div className="empty-state">
              <div className="empty-icon"><Pencil size={21}/></div>
              <b>Your tasks will appear here</b>
              <span>Enter your plans above and let AI extract the activities.</span>
            </div>
          )}
        </section>

        <footer>
          <div className="brand mini">
            <div className="brandmark"><Check size={14}/></div>
            Timely
          </div>
          <span>Make time for what matters.</span>
          <span className="footer-right">AI Parser · Prototype</span>
        </footer>
      </main>
    </div>
  )
}

export default App
