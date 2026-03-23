# Tally Form Automation Task

## Form Details
- **URL**: https://tally.so/r/J9LdGJ
- **Title**: "Tu peux TOUT dire (sans retenue) :"
- **Question**: "Pourquoi tu n'as pas pris de call hier (c'est anonyme) ?"
- **Type**: Single textarea + submit button ("Envoyer")

## Agent Prompt (for scheduled task)

Use this as the `prompt` when creating the scheduled task:

```
Remplis et soumets le formulaire Tally à https://tally.so/r/J9LdGJ

Étapes :
1. agent-browser open https://tally.so/r/J9LdGJ
2. agent-browser wait --load networkidle
3. agent-browser snapshot -i (pour trouver les éléments interactifs)
4. Trouve le champ textarea et remplis-le avec une réponse créative et différente à chaque fois à la question "Pourquoi tu n'as pas pris de call hier ?"
5. Clique sur le bouton "Envoyer"
6. agent-browser wait --load networkidle
7. agent-browser screenshot /tmp/tally-result.png
8. Vérifie la confirmation de soumission

Exemples de réponses possibles (varie à chaque exécution) :
- "J'étais en réunion toute la journée"
- "Mon micro ne marchait plus"
- "J'avais un rendez-vous médical"
- "Je travaillais sur un deadline urgent"
- "Mon chat a débranché mon ordi"
```

## How to Schedule

From the main group, ask the agent:
```
Schedule a task to fill the Tally form every day at 10am:
- Prompt: (use the agent prompt above)
- Schedule: cron "0 10 * * *"
- Context mode: isolated
```

Or create the IPC file directly:
```bash
echo '{
  "type": "schedule_task",
  "prompt": "Remplis et soumets le formulaire Tally à https://tally.so/r/J9LdGJ. Ouvre la page, fais un snapshot -i pour trouver les éléments, remplis le textarea avec une réponse créative à la question \"Pourquoi tu n as pas pris de call hier\", clique sur Envoyer, et vérifie la soumission.",
  "schedule_type": "cron",
  "schedule_value": "0 10 * * *",
  "context_mode": "isolated"
}' > /workspace/ipc/tasks/tally_form_$(date +%s).json
```
