# Phase 12.4: GitHub PRs UI Implementation

## Overview

This document describes the implementation of the GitHub Pull Requests UI components for Phase 12.4 of the Claude Tasks Desktop application.

## Implemented Components

### 1. Types (`src/types/github.ts`)

Created comprehensive TypeScript types for GitHub Pull Requests and Issues:

- `GitHubUser` - User information
- `GitHubLabel` - Label information
- `GitHubPullRequest` - Complete PR entity with all fields
- `GitHubBranch` - Branch information (head/base)
- `GitHubReview` - PR review information
- `GitHubFileChange` - File change details with additions/deletions
- `GitHubPRDisplayState` - Combined state type ('open', 'merged', 'closed')
- `GitHubPRFilters` - Filter options for PR list

### 2. PrCard Component (`src/components/github/PrCard.tsx`)

A card component that displays a PR summary with:

- **PR Number** - Formatted as `#42`
- **State Badge** - Color-coded badge:
  - Green for open PRs
  - Purple for merged PRs
  - Red for closed PRs
- **Title** - PR title displayed prominently
- **Branch Info** - Shows `head → base` branch relationship
- **Review Status** - Visual indicators for:
  - Approved reviews (green checkmark)
  - Changes requested (orange alert)
- **Author Avatar** - GitHub user avatar
- **Stats** - Comments count, files changed count
- **Time** - Relative time since creation

### 3. PrList Component (`src/components/github/PrList.tsx`)

A list view with filtering and sorting capabilities:

#### Filtering
- **Search** - Filter by PR title, number, author, or branch names
- **State Filter** - Filter by:
  - All PRs
  - Open PRs
  - Merged PRs
  - Closed PRs
- Shows count badges for each filter option

#### Sorting
- **Recently created** - Sort by creation date (newest first)
- **Recently updated** - Sort by last update (newest first)
- **Most commented** - Sort by total comments (most first)

#### Features
- Results count display
- "Clear filters" button when filters are active
- Loading state handling
- Empty state with helpful message

### 4. PrDetailModal Component (`src/components/github/PrDetailModal.tsx`)

A modal dialog showing full PR details with three tabs:

#### Overview Tab
- **PR Description** - Full body text in a formatted display
- **Stats Cards** - Four metrics:
  - Files changed count
  - Total comments (PR + review comments)
  - Additions (green, with + icon)
  - Deletions (red, with - icon)
- **Metadata** - Author, creation date, branch info

#### Files Changed Tab
- **File List** - Each file shows:
  - Filename with path
  - Status badge (Added/Removed/Modified/Renamed)
  - Addition/deletion counts
  - Total change count
  - Previous filename (for renames)
- Color-coded badges for file status

#### Reviews Tab (conditional)
- Only shows if there are reviews
- **Review Items** - Each review displays:
  - Reviewer avatar and name
  - Review state icon (approved/changes requested/commented)
  - Review timestamp
  - Review comment body

### 5. Updated PRs Page (`src/routes/github/prs.tsx`)

Main page integrating all components:

- **Header** - Title and refresh button
- **Empty State** - Helpful message when no PRs are available
- **PR List** - Uses PrList component with filtering
- **Detail Modal** - Opens when clicking a PR card
- **Mock Data Support** - Toggle between mock and real data

### 6. Mock Data (`src/lib/mockGithubData.ts`)

Sample data for development and testing:

- Two example PRs (one open, one merged)
- Complete with reviews, file changes, and metadata
- Realistic timestamps and counts

## UI Patterns

### Color Coding
- **Open PRs**: Green (#10b981)
- **Merged PRs**: Purple (#a855f7)
- **Closed PRs**: Red (destructive variant)
- **Additions**: Green with + icon
- **Deletions**: Red with - icon

### State Indicators
- **Approved**: Green checkmark icon
- **Changes Requested**: Orange alert icon
- **Commented**: Blue message icon

### Responsive Design
- Filters stack vertically on small screens
- Modal is scrollable and responsive
- Cards adapt to container width

## Integration Points

### IPC Handlers (To Be Implemented)

The components are ready to integrate with these IPC handlers:

```typescript
// Fetch PRs for a project
const prs = await invoke('github:listPrs', projectId);

// Fetch PR details
const prDetails = await invoke('github:getPrDetails', prNumber);

// Fetch file changes
const files = await invoke('github:getPrFiles', prNumber);

// Fetch reviews
const reviews = await invoke('github:getPrReviews', prNumber);
```

### Usage Example

```tsx
import { useState } from 'react';
import { PrList, PrDetailModal } from '@/components/github';
import { useIPCQuery } from '@/hooks/useIPC';

function MyPRPage({ projectId }: { projectId: string }) {
  const [selectedPr, setSelectedPr] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data: prs, loading } = useIPCQuery(
    'github:listPrs',
    [projectId]
  );

  return (
    <>
      <PrList
        prs={prs ?? []}
        loading={loading}
        onPrClick={(pr) => {
          setSelectedPr(pr);
          setModalOpen(true);
        }}
      />
      <PrDetailModal
        pr={selectedPr}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  );
}
```

## shadcn/ui Components Used

- `Card`, `CardContent`, `CardHeader` - Container components
- `Badge` - State and status indicators
- `Dialog`, `DialogContent`, `DialogHeader` - Modal implementation
- `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger` - Tabbed interface
- `ScrollArea` - Scrollable content areas
- `Avatar`, `AvatarImage`, `AvatarFallback` - User avatars
- `Button` - Action buttons
- `Input` - Search field
- `Select` - Dropdown filters
- `Separator` - Visual dividers

## File Structure

```
src/
├── components/
│   └── github/
│       ├── PrCard.tsx           # PR summary card
│       ├── PrList.tsx           # List with filters
│       ├── PrDetailModal.tsx    # Detail modal
│       └── index.ts             # Exports
├── routes/
│   └── github/
│       └── prs.tsx              # Main PRs page
├── types/
│   └── github.ts                # GitHub types
└── lib/
    └── mockGithubData.ts        # Sample data
```

## Testing

### Manual Testing with Mock Data

1. Navigate to `/github/prs` route
2. Mock data is enabled by default (`useMockData = true`)
3. Test filtering by state (open/merged/closed)
4. Test sorting options
5. Test search functionality
6. Click on a PR card to open detail modal
7. Verify all tabs work correctly

### Future Integration Testing

When IPC handlers are implemented:

1. Set `useMockData = false` in `prs.tsx`
2. Connect to real GitHub repository
3. Test with live data

## Next Steps

1. **Backend Implementation**
   - Create IPC handlers for GitHub API
   - Implement PR fetching logic
   - Add caching and rate limiting

2. **Additional Features**
   - PR creation from UI
   - Comment on PRs
   - Approve/request changes
   - Merge PRs from UI

3. **GitHub Issues**
   - Implement similar components for Issues
   - IssueCard, IssueList, IssueDetailModal
   - Link Issues to Tasks

## Notes

- All components handle loading and error states
- Components use optional chaining for safe data access
- TypeScript strict mode compliance
- Responsive design with Tailwind CSS
- Accessible UI with Radix primitives
