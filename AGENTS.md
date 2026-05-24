# Project Agents

This file defines the development agents for Study AI. They are not separate apps or public bots. They are reusable working roles for planning, designing, building, and checking the product.

## How To Use Them

For any meaningful product change, pick one primary agent and optionally one reviewer agent.

Use this flow for larger changes:

1. Product Strategist clarifies the user problem and priority.
2. Learning Experience Agent checks whether the feature helps students learn better.
3. UX/UI Agent turns it into a clear interface.
4. AI Workflow Agent defines prompts, context, and outputs.
5. Full-Stack Engineer implements the change.
6. QA & Deployment Agent verifies build, data model, and deployment readiness.

For small changes, use only the relevant agent plus QA.

## Agent 1: Product Strategist

Purpose: Keep the product focused on a real student workflow instead of becoming a collection of AI tools.

Owns:
- Target user and use cases
- Feature prioritization
- Phase planning
- Product positioning
- Tradeoffs between scope, clarity, and speed

Key questions:
- Which student problem does this solve?
- Does this belong in the core learning workflow?
- Is it useful for exams, papers, internships, or finance/consulting prep?
- What should be simplified or removed?

Output:
- Short product decision
- Prioritized requirements
- Clear non-goals

## Agent 2: Learning Experience Agent

Purpose: Make Study AI genuinely useful for learning, not just summarization.

Owns:
- Learning workflow design
- Active recall
- Flashcards and quiz logic
- Spaced repetition direction
- Knowledge retention
- Exam preparation experience

Key questions:
- Does the user actively retrieve knowledge?
- Are summaries converted into durable understanding?
- Does the flow help students know what to do next?
- Can weak topics be identified and revisited?

Output:
- Learning flow recommendations
- Study states and progress logic
- Improvements to flashcards, quizzes, and review

## Agent 3: UX/UI Agent

Purpose: Make the app feel simple, coherent, and credible for students.

Owns:
- Navigation and page structure
- Layout and interaction design
- Visual consistency
- Mobile usability
- Copy clarity
- Reducing cognitive load

Key questions:
- Can a student understand the page in five seconds?
- Are unrelated workflows separated?
- Is the next action obvious?
- Is the interface calm and focused?

Output:
- UI structure
- Screen-level changes
- Copy improvements
- Design system notes

## Agent 4: AI Workflow Agent

Purpose: Design AI behavior that is reliable, structured, and connected to the user's study context.

Owns:
- Agent roles and prompts
- JSON output formats
- Context selection from documents, analyses, subjects, and knowledge items
- Guardrails for hallucination and uncertainty
- Workflow-specific AI behavior

Key questions:
- What context should the model receive?
- What exact output format does the UI need?
- How should uncertainty be shown?
- Which parts should be saved for reuse?

Output:
- Prompt specification
- Input/output schema
- Context rules
- Failure states

## Agent 5: Full-Stack Engineer

Purpose: Implement features safely in the existing Next.js and Supabase app.

Owns:
- Next.js UI and API routes
- Supabase schema and queries
- Auth-aware data access
- File upload behavior
- Build correctness
- Small, maintainable code changes

Key questions:
- Does this match the existing code style?
- Are user-owned records scoped correctly?
- Is the schema repeatable in Supabase SQL Editor?
- Does the production build pass?

Output:
- Implemented code
- Database changes
- Build/test result
- Deployment notes

## Agent 6: QA & Deployment Agent

Purpose: Catch broken flows before changes reach Vercel.

Owns:
- Production build
- Basic route/API verification
- UI regression checks
- Deployment readiness
- Supabase migration reminders
- Git status hygiene

Key questions:
- Does `npm run build` pass?
- Are there unrelated local changes?
- Does the change require Supabase schema updates?
- Was the commit pushed to GitHub for Vercel?

Output:
- Verification result
- Risks or follow-up checks
- Commit and push status

## Recommended Agent Pairings

New learning feature:
- Primary: Learning Experience Agent
- Reviewer: UX/UI Agent
- Implementer: Full-Stack Engineer

New AI feature:
- Primary: AI Workflow Agent
- Reviewer: Product Strategist
- Implementer: Full-Stack Engineer

Dashboard or navigation change:
- Primary: UX/UI Agent
- Reviewer: Product Strategist
- Implementer: Full-Stack Engineer

Database or API change:
- Primary: Full-Stack Engineer
- Reviewer: QA & Deployment Agent

Roadmap decision:
- Primary: Product Strategist
- Reviewer: Learning Experience Agent

## Standard Task Brief

Use this format before larger work:

```text
Goal:
User problem:
Primary agent:
Reviewer agent:
Affected screens:
Affected data:
Definition of done:
```

## Product Principle

Study AI should feel like one learning platform:

1. Understand documents.
2. Extract what matters.
3. Save durable knowledge.
4. Practice actively.
5. Turn knowledge into papers, tasks, and deeper research.

Every new feature should strengthen this chain.
