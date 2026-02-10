/**
 * Mock Data Generator
 * 
 * Creates narrative-driven mock conversations forming a coherent
 * project story. Includes diverse content: multiple languages,
 * code snippets, markdown, and varied conversation lengths.
 * 
 * v4 Card-Level Branching: Demonstrates branch points, inherited
 * context, and merge nodes.
 * 
 * @version 4.0.0
 */

import { nanoid } from 'nanoid';
import type {
  Conversation,
  Message,
  EdgeConnection,
  Position,
  BranchPoint,
  InheritedContextEntry,
  InheritanceMode,
  EdgeRelationType,
} from '@/types';
import { generateTreeLayout } from '@/utils/layoutGenerator';

// =============================================================================
// TYPES
// =============================================================================

export interface MockDataResult {
  conversations: Conversation[];
  edges: EdgeConnection[];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createMessage(
  role: 'user' | 'assistant',
  content: string,
  hoursAgo: number = 0
): Message {
  return {
    id: nanoid(),
    role,
    content,
    timestamp: new Date(Date.now() - hoursAgo * 60 * 60 * 1000),
  };
}

function createConversation(
  title: string,
  messages: Message[],
  position: Position,
  connections: string[] = [],
  parentCardIds: string[] = [],
  branchPoint?: BranchPoint,
  inheritedContext?: Record<string, InheritedContextEntry>,
  isMergeNode: boolean = false
): Conversation {
  const now = new Date();
  const firstMessageTime = messages[0]?.timestamp || now;
  
  return {
    id: nanoid(),
    canvasId: 'main',
    position,
    content: messages,
    connections,
    // v4 card-level branching
    parentCardIds,
    branchPoint,
    inheritedContext: inheritedContext || {},
    isMergeNode,
    metadata: {
      title,
      createdAt: firstMessageTime,
      updatedAt: now,
      messageCount: messages.length,
      tags: [],
      isExpanded: false,
    },
  };
}

// =============================================================================
// CONVERSATION DATA
// =============================================================================

/**
 * 1. Project Kickoff - Initial idea exploration
 */
const projectKickoffMessages: Message[] = [
  createMessage('user', `I want to build a task management app. Something like Todoist but with AI features. What's your take on the architecture?`, 72),
  createMessage('assistant', `Great idea! For a modern task management app with AI, I'd suggest:

## Architecture Overview

\`\`\`
┌─────────────────┐     ┌─────────────────┐
│   Next.js App   │────▶│   Supabase DB   │
│   (Frontend)    │     │   (PostgreSQL)  │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│   AI Service    │
│  (Claude API)   │
└─────────────────┘
\`\`\`

Key features to consider:
1. **Natural language task creation** - "Remind me to call mom tomorrow at 5pm"
2. **Smart categorization** - AI auto-tags and prioritizes
3. **Predictive scheduling** - Learn from user patterns

Should I dive deeper into any of these?`, 71),
  createMessage('user', `Love the NLP approach. Let's focus on the natural language parsing first. How would you structure that?`, 70),
  createMessage('assistant', `Here's a TypeScript implementation for NLP task parsing:

\`\`\`typescript
interface ParsedTask {
  title: string;
  dueDate?: Date;
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  recurring?: RecurrencePattern;
}

async function parseNaturalLanguage(
  input: string
): Promise<ParsedTask> {
  const response = await claude.messages.create({
    model: 'claude-3-sonnet',
    messages: [{
      role: 'user',
      content: \`Parse this task: "\${input}"
      
      Extract: title, due date, priority, tags.
      Return as JSON.\`
    }],
  });
  
  return JSON.parse(response.content);
}
\`\`\`

This approach gives us flexibility while leveraging Claude's understanding.`, 69),
];

/**
 * 2. Database Design - Technical planning
 */
const databaseDesignMessages: Message[] = [
  createMessage('user', `Now I need help with the database schema. Using Supabase/PostgreSQL. What tables do we need?`, 68),
  createMessage('assistant', `Here's a comprehensive schema for your task app:

\`\`\`sql
-- Users table (extends Supabase auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users,
  display_name TEXT,
  timezone TEXT DEFAULT 'UTC',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  priority INTEGER DEFAULT 2,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see their own tasks
CREATE POLICY "Users own tasks" ON tasks
  FOR ALL USING (auth.uid() = user_id);
\`\`\`

Want me to add the recurring tasks table?`, 67),
  createMessage('user', `Yes, and also add indexes for performance.`, 66),
  createMessage('assistant', `Adding recurring tasks and performance indexes:

\`\`\`sql
-- Recurring patterns
CREATE TABLE recurring_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
  interval INTEGER DEFAULT 1,
  days_of_week INTEGER[], -- 0-6 for weekly
  day_of_month INTEGER, -- 1-31 for monthly
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_tasks_user_status 
  ON tasks(user_id, status);
  
CREATE INDEX idx_tasks_due_date 
  ON tasks(due_date) 
  WHERE status = 'pending';
  
CREATE INDEX idx_tasks_tags 
  ON tasks USING GIN(tags);

-- Full-text search
ALTER TABLE tasks ADD COLUMN 
  search_vector tsvector 
  GENERATED ALWAYS AS (
    to_tsvector('english', title || ' ' || COALESCE(description, ''))
  ) STORED;

CREATE INDEX idx_tasks_search 
  ON tasks USING GIN(search_vector);
\`\`\`

This gives you fast queries and full-text search! 🚀`, 65),
];

/**
 * 3. Japanese Localization - International support (RTL testing)
 */
const japaneseLocalizationMessages: Message[] = [
  createMessage('user', `I want to add Japanese language support. Can you help translate the UI strings?`, 48),
  createMessage('assistant', `もちろんです！日本語のUIテキストを用意しました：

\`\`\`typescript
// locales/ja.ts
export const ja = {
  common: {
    save: '保存',
    cancel: 'キャンセル',
    delete: '削除',
    edit: '編集',
    loading: '読み込み中...',
  },
  tasks: {
    title: 'タスク',
    addTask: 'タスクを追加',
    dueDate: '期限',
    priority: {
      high: '高',
      medium: '中',
      low: '低',
    },
    status: {
      pending: '未完了',
      completed: '完了',
      archived: 'アーカイブ済み',
    },
    empty: 'タスクがありません',
    naturalLanguagePlaceholder: 
      '例：明日の午後5時に母に電話する',
  },
  ai: {
    analyzing: 'AI分析中...',
    suggestion: 'AIの提案',
    autoTag: '自動タグ付け',
  },
};
\`\`\`

日本語のNLPにはClaude 3が対応しています。日付の形式（2024年3月15日）も自動認識されます。`, 47),
];

/**
 * 4. Arabic RTL Support - Testing RTL rendering
 */
const arabicRTLMessages: Message[] = [
  createMessage('user', `We also need Arabic support. I know it's RTL - what are the considerations?`, 46),
  createMessage('assistant', `Great question! Arabic requires careful RTL handling:

## RTL Considerations

\`\`\`typescript
// locales/ar.ts
export const ar = {
  common: {
    save: 'حفظ',
    cancel: 'إلغاء',
    delete: 'حذف',
    edit: 'تعديل',
  },
  tasks: {
    title: 'المهام',
    addTask: 'إضافة مهمة',
    dueDate: 'تاريخ الاستحقاق',
    priority: {
      high: 'عالية',
      medium: 'متوسطة',
      low: 'منخفضة',
    },
  },
};
\`\`\`

## CSS Considerations

\`\`\`css
/* Use logical properties */
.task-card {
  padding-inline-start: 1rem;
  margin-inline-end: 0.5rem;
  text-align: start;
}

/* Direction-aware flexbox */
[dir="rtl"] .task-header {
  flex-direction: row-reverse;
}
\`\`\`

## Next.js Configuration

\`\`\`typescript
// Add to layout.tsx
<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
\`\`\`

The key is using CSS logical properties instead of left/right! 📝`, 45),
];

/**
 * 5. API Implementation - Backend work
 */
const apiImplementationMessages: Message[] = [
  createMessage('user', `Let's implement the API routes. Using Next.js App Router with server actions.`, 40),
  createMessage('assistant', `Here's a complete API implementation:

\`\`\`typescript
// app/actions/tasks.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { parseNaturalLanguage } from '@/lib/ai/parser'

export async function createTask(formData: FormData) {
  const supabase = createClient()
  const input = formData.get('input') as string
  
  // Parse natural language input
  const parsed = await parseNaturalLanguage(input)
  
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: parsed.title,
      due_date: parsed.dueDate,
      priority: parsed.priority,
      tags: parsed.tags,
    })
    .select()
    .single()
  
  if (error) throw error
  
  revalidatePath('/tasks')
  return data
}

export async function updateTaskStatus(
  taskId: string, 
  status: string
) {
  const supabase = createClient()
  
  await supabase
    .from('tasks')
    .update({ 
      status,
      completed_at: status === 'completed' 
        ? new Date().toISOString() 
        : null
    })
    .eq('id', taskId)
  
  revalidatePath('/tasks')
}
\`\`\`

This gives you type-safe server actions with AI integration!`, 39),
  createMessage('user', `How do we handle errors gracefully?`, 38),
  createMessage('assistant', `Let's add comprehensive error handling:

\`\`\`typescript
// lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 500
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const ErrorCodes = {
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  AI_PARSE_FAILED: 'AI_PARSE_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
} as const

// app/actions/tasks.ts
export async function createTask(formData: FormData) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new AppError(
        'Authentication required',
        ErrorCodes.UNAUTHORIZED,
        401
      )
    }
    
    const input = formData.get('input') as string
    
    let parsed
    try {
      parsed = await parseNaturalLanguage(input)
    } catch (e) {
      throw new AppError(
        'Could not understand task',
        ErrorCodes.AI_PARSE_FAILED,
        422
      )
    }
    
    // ... rest of implementation
  } catch (error) {
    if (error instanceof AppError) {
      return { error: error.message, code: error.code }
    }
    return { error: 'Something went wrong' }
  }
}
\`\`\`

Now errors are typed and user-friendly! ✨`, 37),
];

/**
 * 6. Debugging Session - Problem solving
 */
const debuggingSessionMessages: Message[] = [
  createMessage('user', `I'm getting a weird error: "Cannot read properties of undefined (reading 'map')" when rendering tasks. Here's my component:

\`\`\`tsx
function TaskList({ tasks }) {
  return (
    <ul>
      {tasks.map(task => (
        <TaskItem key={task.id} task={task} />
      ))}
    </ul>
  )
}
\`\`\``, 24),
  createMessage('assistant', `Classic async data issue! The \`tasks\` prop is \`undefined\` before the data loads. Here are 3 fixes:

## Option 1: Default Parameter
\`\`\`tsx
function TaskList({ tasks = [] }) {
  return (
    <ul>
      {tasks.map(task => (
        <TaskItem key={task.id} task={task} />
      ))}
    </ul>
  )
}
\`\`\`

## Option 2: Optional Chaining
\`\`\`tsx
function TaskList({ tasks }) {
  return (
    <ul>
      {tasks?.map(task => (
        <TaskItem key={task.id} task={task} />
      ))}
    </ul>
  )
}
\`\`\`

## Option 3: Early Return (Best for loading states)
\`\`\`tsx
function TaskList({ tasks, isLoading }) {
  if (isLoading) return <Skeleton />
  if (!tasks?.length) return <EmptyState />
  
  return (
    <ul>
      {tasks.map(task => (
        <TaskItem key={task.id} task={task} />
      ))}
    </ul>
  )
}
\`\`\`

I recommend Option 3 for the best UX! 🎯`, 23),
  createMessage('user', `Option 3 worked perfectly. But now I'm seeing hydration errors in Next.js.`, 22),
  createMessage('assistant', `Hydration errors happen when server and client HTML don't match. Common causes:

## 1. Using \`Date.now()\` or \`Math.random()\`
\`\`\`tsx
// ❌ Bad - different on server vs client
<span>{Date.now()}</span>

// ✅ Good - use effect for client-only values
const [time, setTime] = useState<number>()
useEffect(() => setTime(Date.now()), [])
\`\`\`

## 2. Browser-only APIs
\`\`\`tsx
// ❌ Bad - window doesn't exist on server
const width = window.innerWidth

// ✅ Good - check for browser
const [width, setWidth] = useState(0)
useEffect(() => {
  setWidth(window.innerWidth)
}, [])
\`\`\`

## 3. Timestamps in locale format
\`\`\`tsx
// ❌ Bad - locale differs between server/client
<span>{new Date(task.createdAt).toLocaleString()}</span>

// ✅ Good - use consistent formatting
import { format } from 'date-fns'
<span>{format(new Date(task.createdAt), 'PPp')}</span>
\`\`\`

Can you share the specific hydration error message?`, 21),
];

/**
 * 7. Performance Optimization - Deep dive
 */
const performanceMessages: Message[] = [
  createMessage('user', `The app is getting slow with 500+ tasks. How can we optimize?`, 12),
  createMessage('assistant', `Great timing to optimize! Here's a performance deep-dive:

## 1. Virtual List for Large Data
\`\`\`tsx
import { useVirtualizer } from '@tanstack/react-virtual'

function TaskList({ tasks }) {
  const parentRef = useRef<HTMLDivElement>(null)
  
  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // estimated row height
    overscan: 5,
  })
  
  return (
    <div ref={parentRef} className="h-150 overflow-auto">
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <TaskItem 
            key={tasks[virtualRow.index].id}
            task={tasks[virtualRow.index]}
            style={{
              position: 'absolute',
              top: virtualRow.start,
              height: virtualRow.size,
            }}
          />
        ))}
      </div>
    </div>
  )
}
\`\`\`

## 2. Pagination at Database Level
\`\`\`typescript
const PAGE_SIZE = 50

async function getTasks(page: number) {
  const { data } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
  
  return data
}
\`\`\`

## 3. Memoize Expensive Components
\`\`\`tsx
const TaskItem = memo(function TaskItem({ task }) {
  return (...)
})
\`\`\`

These changes should handle 10,000+ tasks smoothly! 📊`, 11),
];

/**
 * 8. Rust Backend Exploration - Alternative tech
 */
const rustExplorationMessages: Message[] = [
  createMessage('user', `I'm curious about rewriting the AI parsing service in Rust for better performance. Is it worth it?`, 8),
  createMessage('assistant', `Interesting question! Let me give you a balanced view:

## Rust Pros for AI Services
- **10-100x faster** than Node.js for CPU-bound tasks
- **Memory safety** without GC pauses
- **Predictable latency** for real-time features

## Simple Rust Example
\`\`\`rust
use axum::{routing::post, Json, Router};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct ParseRequest {
    input: String,
}

#[derive(Serialize)]
struct ParsedTask {
    title: String,
    due_date: Option<String>,
    priority: u8,
}

async fn parse_task(
    Json(req): Json<ParseRequest>
) -> Json<ParsedTask> {
    // Call Claude API from Rust
    let client = anthropic::Client::new();
    let response = client
        .messages()
        .create(/* ... */)
        .await?;
    
    // Parse and return
    Json(parse_response(response))
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/parse", post(parse_task));
    
    axum::serve(
        TcpListener::bind("0.0.0.0:3001").await?,
        app
    ).await?;
}
\`\`\`

## My Recommendation
For your use case (API calls to Claude), the bottleneck is **network I/O**, not CPU. Node.js/TypeScript is fine.

Consider Rust when:
- Processing millions of tasks locally
- Running ML models on-device
- Need sub-millisecond response times

Stick with TypeScript for now, optimize later if needed! 🦀`, 7),
];

/**
 * 9. Spanish UI Copy - More i18n
 */
const spanishUIMessages: Message[] = [
  createMessage('user', `Adding Spanish as well. Can you provide the translations?`, 6),
  createMessage('assistant', `¡Por supuesto! Aquí están las traducciones al español:

\`\`\`typescript
// locales/es.ts
export const es = {
  common: {
    save: 'Guardar',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    edit: 'Editar',
    loading: 'Cargando...',
    search: 'Buscar',
    settings: 'Configuración',
  },
  tasks: {
    title: 'Tareas',
    addTask: 'Agregar tarea',
    newTask: 'Nueva tarea',
    dueDate: 'Fecha límite',
    priority: {
      high: 'Alta',
      medium: 'Media',
      low: 'Baja',
    },
    status: {
      pending: 'Pendiente',
      inProgress: 'En progreso',
      completed: 'Completada',
      archived: 'Archivada',
    },
    empty: 'No hay tareas todavía',
    naturalLanguagePlaceholder: 
      'Ej: Llamar a mamá mañana a las 5pm',
  },
  ai: {
    analyzing: 'Analizando con IA...',
    suggestion: 'Sugerencia de IA',
    autoTag: 'Etiquetado automático',
    smartSchedule: 'Programación inteligente',
  },
  errors: {
    generic: 'Algo salió mal',
    notFound: 'No encontrado',
    unauthorized: 'Acceso no autorizado',
  },
};
\`\`\`

Claude entiende español perfectamente para el análisis de lenguaje natural. ¡Tu app estará lista para el mercado hispanohablante! 🇪🇸🇲🇽🇦🇷`, 5),
];

/**
 * 10. Deployment & Launch - Final steps
 */
const deploymentMessages: Message[] = [
  createMessage('user', `We're ready to deploy! What's the production checklist?`, 2),
  createMessage('assistant', `Here's your production deployment checklist:

## Pre-Deployment ✅

### Security
- [ ] Environment variables secured (not in repo)
- [ ] API keys rotated from development
- [ ] RLS policies tested thoroughly
- [ ] Rate limiting configured
- [ ] CORS properly configured

### Performance
- [ ] Images optimized (next/image)
- [ ] Bundle analyzed (no huge dependencies)
- [ ] Database indexes verified
- [ ] CDN configured for static assets

### Monitoring
- [ ] Error tracking (Sentry)
- [ ] Analytics (Posthog/Plausible)
- [ ] Uptime monitoring
- [ ] Database monitoring

## Vercel Deployment

\`\`\`bash
# Install Vercel CLI
npm i -g vercel

# Deploy to preview
vercel

# Deploy to production
vercel --prod
\`\`\`

## Environment Variables (Vercel Dashboard)
\`\`\`
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
\`\`\`

## Post-Deployment
- [ ] Smoke test all features
- [ ] Verify OAuth flows work
- [ ] Test in incognito mode
- [ ] Check mobile responsiveness
- [ ] Verify i18n routes work

Ready to launch! 🚀`, 1),
  createMessage('user', `Amazing! One last thing - how do we set up preview deployments for PRs?`, 0.5),
  createMessage('assistant', `Vercel handles this automatically! But here's how to customize:

## Automatic Preview Deployments

Every PR gets a unique preview URL:
\`\`\`
https://your-app-git-feature-branch.vercel.app
\`\`\`

## GitHub Action for Extra Checks

\`\`\`yaml
# .github/workflows/preview.yml
name: Preview

on:
  pull_request:
    branches: [main]

jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
      
      - name: Comment Preview URL
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '🚀 Preview: https://...'
            })
\`\`\`

## Protect Production
\`\`\`json
// vercel.json
{
  "git": {
    "deploymentEnabled": {
      "main": true,
      "feature/*": true
    }
  }
}
\`\`\`

You're all set for a professional CI/CD workflow! 🎉`, 0),
];

// =============================================================================
// MAIN GENERATOR
// =============================================================================

/**
 * Generate the complete mock data set
 * 
 * Creates 10 logically connected conversations forming a coherent
 * project story from initial idea through deployment.
 * 
 * v4 Branching Demo:
 * - Card 0 (Kickoff) is root with no parents
 * - Card 1 (Database) branches from Kickoff at message 3 (full context)
 * - Card 2 (Japanese i18n) branches from Kickoff at message 2 (full context)
 * - Card 3 (Arabic RTL) branches from Kickoff at message 2 (full context)
 * - Card 4 (API) branches from Database (full context)
 * - Card 10 (i18n Synthesis) is a MERGE NODE combining Japanese + Arabic + Spanish
 */
export function generateMockData(): MockDataResult {
  // Create conversations with temporary positions (will be updated)
  const tempPosition: Position = { x: 0, y: 0 };
  
  // Helper to create branch point
  const makeBranchPoint = (parentCardId: string, messageIndex: number): BranchPoint => ({
    parentCardId,
    messageIndex,
  });
  
  // Helper to create inherited context entry with sample messages
  const makeInheritedContext = (
    mode: InheritanceMode,
    messages: Message[],
    totalParentMessages: number
  ): InheritedContextEntry => ({
    mode,
    messages,
    timestamp: new Date(),
    totalParentMessages,
  });
  
  // Step 1: Create root conversation (no parents)
  const kickoff = createConversation(
    'Project Kickoff',
    projectKickoffMessages,
    tempPosition,
    [], // connections filled later
    [], // no parents - root
    undefined, // no branch point
    {}, // no inherited context
    false
  );
  
  // Step 2: Create branched conversations with proper v4 metadata
  const database = createConversation(
    'Database Design',
    databaseDesignMessages,
    tempPosition,
    [],
    [kickoff.id], // branched from kickoff
    makeBranchPoint(kickoff.id, 2), // branched after 3rd message
    {
      [kickoff.id]: makeInheritedContext('full', projectKickoffMessages.slice(0, 3), projectKickoffMessages.length),
    },
    false
  );
  
  const japaneseI18n = createConversation(
    'Japanese i18n',
    japaneseLocalizationMessages,
    tempPosition,
    [],
    [kickoff.id],
    makeBranchPoint(kickoff.id, 1),
    {
      [kickoff.id]: makeInheritedContext('full', projectKickoffMessages.slice(0, 2), projectKickoffMessages.length),
    },
    false
  );
  
  const arabicRTL = createConversation(
    'Arabic RTL',
    arabicRTLMessages,
    tempPosition,
    [],
    [kickoff.id],
    makeBranchPoint(kickoff.id, 1),
    {
      [kickoff.id]: makeInheritedContext('full', projectKickoffMessages.slice(0, 2), projectKickoffMessages.length),
    },
    false
  );
  
  const apiImpl = createConversation(
    'API Implementation',
    apiImplementationMessages,
    tempPosition,
    [],
    [database.id],
    makeBranchPoint(database.id, 3),
    {
      [database.id]: makeInheritedContext('full', databaseDesignMessages.slice(0, 4), databaseDesignMessages.length),
    },
    false
  );
  
  const debugging = createConversation(
    'Debugging Session',
    debuggingSessionMessages,
    tempPosition,
    [],
    [apiImpl.id],
    makeBranchPoint(apiImpl.id, 5),
    {
      [apiImpl.id]: makeInheritedContext('full', apiImplementationMessages.slice(0, 6), apiImplementationMessages.length),
    },
    false
  );
  
  const performance = createConversation(
    'Performance',
    performanceMessages,
    tempPosition,
    [],
    [debugging.id],
    makeBranchPoint(debugging.id, 7),
    {
      [debugging.id]: makeInheritedContext('full', debuggingSessionMessages.slice(0, 8), debuggingSessionMessages.length),
    },
    false
  );
  
  const rustExploration = createConversation(
    'Rust Exploration',
    rustExplorationMessages,
    tempPosition,
    [],
    [performance.id],
    makeBranchPoint(performance.id, 3),
    {
      [performance.id]: makeInheritedContext('full', performanceMessages.slice(0, 2), performanceMessages.length),
    },
    false
  );
  
  const spanishUI = createConversation(
    'Spanish i18n',
    spanishUIMessages,
    tempPosition,
    [],
    [japaneseI18n.id],
    makeBranchPoint(japaneseI18n.id, 3),
    {
      [japaneseI18n.id]: makeInheritedContext('full', japaneseLocalizationMessages.slice(0, 4), japaneseLocalizationMessages.length),
    },
    false
  );
  
  const deployment = createConversation(
    'Deployment',
    deploymentMessages,
    tempPosition,
    [],
    [performance.id],
    makeBranchPoint(performance.id, 4),
    {
      [performance.id]: makeInheritedContext('full', performanceMessages.slice(0, 5), performanceMessages.length),
    },
    false
  );
  
  // Step 3: Create a MERGE NODE that synthesizes i18n work
  // This demonstrates the v4 multi-parent merge capability
  const i18nSynthesis = createConversation(
    '🔀 i18n Synthesis',
    [
      createMessage('user', 'Can you synthesize our internationalization approach based on the Japanese, Arabic, and Spanish implementations?', 2),
      createMessage('assistant', `## i18n Strategy Synthesis

Based on our exploration across three languages, here's our unified approach:

### Key Patterns Identified

| Language | Key Challenge | Solution |
|----------|--------------|----------|
| Japanese | Character width | Dynamic layout + \`clamp()\` |
| Arabic | RTL + numerals | \`dir="rtl"\` + logical properties |
| Spanish | Text expansion | Flexible containers + truncation |

### Recommended Stack

\`\`\`typescript
// Unified i18n configuration
const i18nConfig = {
  fallbackLocale: 'en',
  locales: ['en', 'ja', 'ar', 'es'],
  defaultDirection: 'ltr',
  rtlLocales: ['ar', 'he'],
};
\`\`\`

This synthesis combines the best practices from each language exploration! 🌍`, 1),
    ],
    tempPosition,
    [],
    [japaneseI18n.id, arabicRTL.id, spanishUI.id], // THREE parents - merge node
    undefined, // merge nodes don't have a single branch point
    {
      [japaneseI18n.id]: makeInheritedContext('full', japaneseLocalizationMessages.slice(0, 4), japaneseLocalizationMessages.length),
      [arabicRTL.id]: makeInheritedContext('full', arabicRTLMessages.slice(0, 4), arabicRTLMessages.length),
      [spanishUI.id]: makeInheritedContext('full', spanishUIMessages.slice(0, 4), spanishUIMessages.length),
    },
    true // IS a merge node
  );
  
  // Collect all conversations in order
  const conversations = [
    kickoff,      // 0
    database,     // 1
    japaneseI18n, // 2
    arabicRTL,    // 3
    apiImpl,      // 4
    debugging,    // 5
    performance,  // 6
    rustExploration, // 7
    spanishUI,    // 8
    deployment,   // 9
    i18nSynthesis, // 10 - merge node
  ];
  
  // Define edges with v4 relation types
  const edgeDefinitions: Array<{
    sourceIdx: number;
    targetIdx: number;
    relationType: EdgeRelationType;
  }> = [
    { sourceIdx: 0, targetIdx: 1, relationType: 'branch' },  // Kickoff → Database
    { sourceIdx: 0, targetIdx: 2, relationType: 'branch' },  // Kickoff → Japanese
    { sourceIdx: 0, targetIdx: 3, relationType: 'branch' },  // Kickoff → Arabic
    { sourceIdx: 1, targetIdx: 4, relationType: 'branch' },  // Database → API
    { sourceIdx: 4, targetIdx: 5, relationType: 'branch' },  // API → Debugging
    { sourceIdx: 5, targetIdx: 6, relationType: 'branch' },  // Debugging → Performance
    { sourceIdx: 6, targetIdx: 7, relationType: 'branch' },  // Performance → Rust
    { sourceIdx: 2, targetIdx: 8, relationType: 'branch' },  // Japanese → Spanish
    { sourceIdx: 6, targetIdx: 9, relationType: 'branch' },  // Performance → Deployment
    // Merge edges (emerald colored)
    { sourceIdx: 2, targetIdx: 10, relationType: 'merge' }, // Japanese → Synthesis
    { sourceIdx: 3, targetIdx: 10, relationType: 'merge' }, // Arabic → Synthesis
    { sourceIdx: 8, targetIdx: 10, relationType: 'merge' }, // Spanish → Synthesis
  ];
  
  // Generate tree layout (excluding merge node for initial layout)
  const branchPairs = edgeDefinitions
    .filter(e => e.relationType === 'branch')
    .map(e => ({ source: e.sourceIdx, target: e.targetIdx }));
    
  const layout = generateTreeLayout(
    branchPairs,
    { count: conversations.length },
    42 // Seed for consistent layout
  );
  
  // Update positions
  conversations.forEach((conv, index) => {
    conv.position = layout.positions[index] || { x: 1400, y: 300 }; // Default for merge node
  });
  
  // Position merge node to the right of its parents
  const mergeParentPositions = [2, 3, 8].map(i => conversations[i].position);
  const avgY = mergeParentPositions.reduce((sum, p) => sum + p.y, 0) / mergeParentPositions.length;
  const maxX = Math.max(...mergeParentPositions.map(p => p.x));
  conversations[10].position = { x: maxX + 400, y: avgY };
  
  // Create edge connections
  const edges: EdgeConnection[] = edgeDefinitions.map(({ sourceIdx, targetIdx, relationType }) => ({
    id: `edge-${conversations[sourceIdx].id}-${conversations[targetIdx].id}`,
    source: conversations[sourceIdx].id,
    target: conversations[targetIdx].id,
    curveType: 'bezier' as const,
    relationType,
    animated: relationType === 'merge', // Merge edges are animated
  }));
  
  // Update conversation connections
  edgeDefinitions.forEach(({ sourceIdx, targetIdx }) => {
    conversations[sourceIdx].connections.push(conversations[targetIdx].id);
  });
  
  return { conversations, edges };
}

/**
 * Get a single conversation by index (for testing)
 */
export function getMockConversation(index: number): Conversation | undefined {
  const { conversations } = generateMockData();
  return conversations[index];
}

/**
 * Get conversations count
 */
export function getMockConversationCount(): number {
  return 11; // Includes merge node
}

export default generateMockData;
