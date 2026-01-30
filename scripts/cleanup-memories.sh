#!/bin/bash
#
# Script to clean up bad/gibberish memories from terminal capture issues.
# Only affects auto_session memories, not manually created ones.
#
# Usage: ./scripts/cleanup-memories.sh
#

# Database path (macOS)
DB_PATH="$HOME/Library/Application Support/claude-tasks-desktop/claude-tasks.db"

if [ ! -f "$DB_PATH" ]; then
    echo "Error: Database file not found at: $DB_PATH"
    exit 1
fi

echo "Database path: $DB_PATH"
echo ""

# Count total auto_session memories before cleanup
TOTAL_BEFORE=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Memory WHERE source = 'auto_session';")
echo "Total auto_session memories before cleanup: $TOTAL_BEFORE"

# Find and display bad memories (those with escape sequences)
# Pattern explanation:
# - %[?2004% - Bracketed paste mode escape sequence
# - %x1b% - Raw escape character (hex representation in content)
# - %\x1b% - Escaped escape char as literal string
# - %\u001b% - Unicode escape representation

echo ""
echo "Looking for memories with bad content patterns..."
echo ""

# Show memories to be deleted
sqlite3 "$DB_PATH" <<'EOF'
.mode column
.headers on
SELECT
    id,
    substr(title, 1, 50) as title_preview,
    substr(content, 1, 80) as content_preview,
    datetime(createdAt/1000, 'unixepoch', 'localtime') as created
FROM Memory
WHERE source = 'auto_session'
AND (
    content LIKE '%[?2004h%' OR
    content LIKE '%[?2004l%' OR
    content LIKE '%[200~%' OR
    content LIKE '%[201~%' OR
    content LIKE '%' || char(27) || '%' OR
    content LIKE '%x1b%' OR
    content LIKE '%\x1b%' OR
    content LIKE '%\u001b%'
)
LIMIT 20;
EOF

# Count bad memories
BAD_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Memory WHERE source = 'auto_session' AND (content LIKE '%[?2004h%' OR content LIKE '%[?2004l%' OR content LIKE '%[200~%' OR content LIKE '%[201~%' OR content LIKE '%' || char(27) || '%' OR content LIKE '%x1b%' OR content LIKE '%\x1b%' OR content LIKE '%\u001b%');")

echo ""
echo "Found $BAD_COUNT bad memories to delete"
echo ""

if [ "$BAD_COUNT" -gt 0 ]; then
    read -p "Do you want to delete these memories? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Delete bad memories
        sqlite3 "$DB_PATH" "DELETE FROM Memory WHERE source = 'auto_session' AND (content LIKE '%[?2004h%' OR content LIKE '%[?2004l%' OR content LIKE '%[200~%' OR content LIKE '%[201~%' OR content LIKE '%' || char(27) || '%' OR content LIKE '%x1b%' OR content LIKE '%\x1b%' OR content LIKE '%\u001b%');"

        TOTAL_AFTER=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Memory WHERE source = 'auto_session';")
        DELETED=$((TOTAL_BEFORE - TOTAL_AFTER))

        echo ""
        echo "Cleanup complete!"
        echo "  Deleted: $DELETED memories"
        echo "  Remaining auto_session memories: $TOTAL_AFTER"
    else
        echo "Cleanup cancelled."
    fi
else
    echo "No bad memories found - database is clean!"
fi
