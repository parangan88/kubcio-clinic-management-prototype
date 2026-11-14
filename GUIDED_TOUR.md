# Guided Tour

How to use the Kubcio clinic prototype: first a 5-minute story that touches every feature, then a reference by role.

**Open:** https://kubcio-clinic-management-prototype.vercel.app/

**Before you start**

- Use the **role switcher** in the header to act as Receptionist, Nurse or Physician.
- All data is synthetic and saved only in your browser.
- **Reset demo** restores the starting data whenever you want a clean run.

<!-- VERIFY: check button and screen names below against the live app and adjust any labels that differ. -->

---

## Part 1 — The 5-minute story

Follow one patient, Meera Sen, from arrival to study consent.

| Step | Role | Do this | What to notice |
| --- | --- | --- | --- |
| 1 | Receptionist | Find Meera on today's expected list and check her in, keeping the reason "Tiredness, thirst" | Her phone number is on the row |
| 2 | Nurse | Open Meera from the queue. Enter BP 138/88, weight 82 kg, temperature 36.8 °C, and "Thirsty for a month, waking at night to pass urine". Save | She leaves the nurse queue and is ready for the physician |
| 3 | Physician | Open Meera's visit | Reason and nurse observations are on one screen. The study panel says **needs review**, because an old note reads "?diabetes" |
| 4 | Physician | Write a short note. Order an HbA1c with reason "Possible diabetes". Add a reception task: "Book follow-up", 7 days after the HbA1c result. Finish the visit | The task is saved as waiting on the result |
| 5 | Receptionist | Open Meera's checkout card | You see her phone and "Book follow-up: after result, date to be set", but no clinical details. Mark her as left |
| 6 | Any | In **Demo controls**, simulate the HbA1c result arriving | This stands in for a result coming back days later |
| 7 | Physician | Open the results inbox and review the HbA1c. Add the note "HbA1c confirms type 2 diabetes" | The inbox showed the reason it was ordered and a study flag. After review, the study outcome changes to **meets**, with your sentence as evidence |
| 8 | Physician | Approve Meera for the diabetes study | She moves to reception's outreach list |
| 9 | Receptionist | Open the task list, then the outreach list. Log a call: reached, consented | "Book follow-up" is now due 7 days from today. Outreach shows name, phone and study name only |
| 10 | Any | Click **Reset demo** | Everything returns to the starting data |

---

## Part 2 — By role

### Receptionist

| Feature | How to use it |
| --- | --- |
| Today's expected list | Shows time, name, booked reason and status. Checked-in patients look different from those still expected |
| Check in | Confirm the booked reason or type a new one. A reason is required |
| Walk-in | Search for an existing patient, or create one with name, date of birth and phone. The visit starts as checked in |
| Checkout card | Shows the patient's phone and the tasks you're responsible for, with due dates. Mark tasks done, then mark the patient as left |
| Task list | Every open task across all patients, by due date, with overdue tasks highlighted. Tasks waiting on a result appear below with no result details |
| Study outreach | Patients the physician approved, with phone and study name. Log each call: not reached, or reached with declined, consented or call back later |
| No study calls | Turn this on for a patient who asks to be left out of all study calls |

**What you won't see as reception:** vitals, nurse notes, the physician's assessment, diagnoses, results or why a patient qualifies for a study. That is by design.

### Nurse

| Feature | How to use it |
| --- | --- |
| Ready queue | Checked-in patients in arrival order, each with the reason for the visit |
| Intake | Enter blood pressure (mmHg), weight (kg), temperature (°C) and what the patient reports. Non-numeric vitals are rejected beside the field. Saving sends the patient to the physician |
| History | Read-only view of the patient's history, without the physician's assessment |

### Physician

| Feature | How to use it |
| --- | --- |
| Ready list | Patients ready to be seen, with reason and waiting time |
| Visit summary | Reason, today's observations, active diagnoses, the three latest notes, and results still waiting for review, on one screen |
| Note | Saving a note also re-checks study eligibility |
| Order a test | Needs a test name and the reason, which is shown again when the result comes back |
| Reception task | An action plus timing: a date, in N days, or N days after a result. Tasks tied to a result wait until you review it |
| Finish visit | Sends the patient to reception's checkout |
| Results inbox | Results waiting for you, oldest first, each with why it was ordered. A badge shows the count |
| Review result | Add a review note and optionally a reception task. Waiting follow-ups open automatically. If the patient's study status changes, you see old and new |
| Study panel | For each study: the outcome, each criterion's result, and the evidence (diagnosis entry or quoted note with its date) or the reason for needs review |
| Candidate list | Everyone who meets or needs review, needs review first. Opted-out and declined patients are flagged and can't be approved |
| Decision | Approve contact or mark not eligible. Nobody is called without your approval |

### Demo controls (any role)

| Control | What it does |
| --- | --- |
| Simulate result | Pick a pending order, enter a value, and it arrives now |
| Reset demo | Clears your changes and reloads the starting data, after a confirm prompt |

---

## Part 3 — Edge cases worth trying

The starting data includes patients built to test the study rules. Open their study panels as the physician.

| Chart shows | Expected outcome |
| --- | --- |
| Diabetes on the diagnosis list | Meets |
| Diabetes mentioned only in a note from 2021 | Meets, evidence dated 2021 |
| "Prediabetes" | Doesn't meet |
| "Mother has type 2 diabetes" | Doesn't meet |
| "No history of diabetes" | Doesn't meet |
| Diabetes on the list and a note saying "No history of diabetes" | Needs review, conflicting chart |
| Only past gestational diabetes | Needs review, study criteria don't say |
| "?diabetes" or "Started metformin" only | Needs review |
| HbA1c pending, no other mention | Needs review until the physician reviews the result |
| Meets but opted out of study calls | Meets, flagged, never on outreach |
| Meets but declined this study | Meets, flagged as declined, never called again |

---

## Part 4 — Check the handoff yourself

Switch to Receptionist on any patient and confirm that no vitals, notes, diagnoses, results or study evidence appear anywhere. Then switch to Physician on the same patient to see the full picture.
