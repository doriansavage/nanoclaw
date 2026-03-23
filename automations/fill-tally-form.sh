#!/usr/bin/env bash
# Automation: Fill and submit the Tally form at https://tally.so/r/J9LdGJ
#
# Form: "Tu peux TOUT dire (sans retenue) :"
# Single textarea: "Pourquoi tu n'as pas pris de call hier ?"
# Submit button: "Envoyer"
#
# Usage: ./fill-tally-form.sh "Your response text here"
# If no argument, a default message is used.

set -euo pipefail

FORM_URL="https://tally.so/r/J9LdGJ"
RESPONSE_TEXT="${1:-Je n'étais pas disponible hier, désolé.}"

echo "=== Tally Form Automation ==="
echo "Opening form: $FORM_URL"

# Step 1: Open the form
agent-browser open "$FORM_URL"

# Step 2: Wait for the page to fully load
agent-browser wait --load networkidle

# Step 3: Snapshot interactive elements to find the textarea and submit button
echo "Analyzing form structure..."
SNAPSHOT=$(agent-browser snapshot -i)
echo "$SNAPSHOT"

# Step 4: Find and fill the textarea
# Tally forms use dynamic refs, so we use semantic locators as fallback
if echo "$SNAPSHOT" | grep -q "textarea\|textbox"; then
    # Extract the first textarea/textbox ref
    TEXTAREA_REF=$(echo "$SNAPSHOT" | grep -oP '(?:textarea|textbox).*?\[ref=\K[^\]]+' | head -1)
    if [ -n "$TEXTAREA_REF" ]; then
        echo "Filling textarea ref=$TEXTAREA_REF with response..."
        agent-browser fill "@$TEXTAREA_REF" "$RESPONSE_TEXT"
    else
        echo "No ref found, trying semantic locator..."
        agent-browser find role textbox fill "$RESPONSE_TEXT"
    fi
else
    echo "No textarea found in snapshot, trying semantic locator..."
    agent-browser find role textbox fill "$RESPONSE_TEXT"
fi

# Step 5: Small wait for form validation
sleep 1

# Step 6: Click the submit button ("Envoyer")
echo "Submitting form..."
if echo "$SNAPSHOT" | grep -q "Envoyer"; then
    SUBMIT_REF=$(echo "$SNAPSHOT" | grep -oP 'Envoyer.*?\[ref=\K[^\]]+' | head -1)
    if [ -z "$SUBMIT_REF" ]; then
        SUBMIT_REF=$(echo "$SNAPSHOT" | grep -oP '\[ref=\K[^\]]+' | tail -1)
    fi
    if [ -n "$SUBMIT_REF" ]; then
        agent-browser click "@$SUBMIT_REF"
    else
        agent-browser find text "Envoyer" click
    fi
else
    agent-browser find role button --name "Envoyer" click
fi

# Step 7: Wait for submission confirmation
echo "Waiting for confirmation..."
agent-browser wait --load networkidle
sleep 2

# Step 8: Take a screenshot for verification
agent-browser screenshot /tmp/tally-form-submitted.png

# Step 9: Check for success indicators
FINAL_SNAPSHOT=$(agent-browser snapshot)
if echo "$FINAL_SNAPSHOT" | grep -qi "merci\|thank\|soumis\|submitted\|envoyé"; then
    echo "SUCCESS: Form submitted successfully!"
else
    echo "WARNING: Could not confirm submission. Check screenshot at /tmp/tally-form-submitted.png"
    echo "Final page content:"
    echo "$FINAL_SNAPSHOT" | head -20
fi

echo "=== Automation complete ==="
