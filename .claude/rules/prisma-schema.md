---
paths:
  - "prisma/**/*"
---

# Prisma Schema Rules

## Model Design

- Use `cuid()` for IDs (better than UUID for sorting)
- Include `createdAt` and `updatedAt` on all models
- Define `onDelete` behavior explicitly
- Add indexes for frequently queried fields

```prisma
model Task {
  id        String   @id @default(cuid())
  title     String
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([projectId])
  @@index([status])
}
```

## SQLite Constraints

- Store JSON arrays as strings (`String @default("[]")`)
- Use enums (they work as strings in SQLite)
- No native JSON operators - use raw SQL if needed
- DateTime stored as ISO strings internally

## Relations

- Always define both sides of relations
- Use meaningful relation names
- Handle circular relations with nullable fields

## Migrations

- Write descriptive migration names
- Test migrations on sample data
- Plan for production migration strategy
- Never edit existing migrations in production
