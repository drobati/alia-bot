# Poll Command Test Suite

## Test 1: Basic Poll Creation
```
/poll create question:What's your favorite programming language? options:JavaScript, Python, TypeScript, Rust
```

## Test 2: Short Poll with Duration
```
/poll create question:Quick lunch vote? options:Pizza, Burgers, Sushi duration:15
```

## Test 3: Multiple Choice Poll
```
/poll create question:Which features should we add next? options:Dark mode, Mobile app, API docs, Better search, Export tools duration:120
```

## Test 4: Simple Yes/No Poll
```
/poll create question:Should we have the team meeting at 3pm? options:Yes, No, Maybe duration:60
```

## Test 5: Long Duration Poll (Daily Standup)
```
/poll create question:What time works best for daily standup? options:9am, 10am, 11am, 2pm duration:1440
```

## Test 6: Gaming Poll
```
/poll create question:Which game should we play this weekend? options:Among Us, Minecraft, Valorant, Chess duration:480
```

## Test 7: Food Preference Poll
```
/poll create question:Office snack preference? options:Healthy snacks, Sweet treats, Salty chips, Fresh fruit, Mixed nuts duration:180
```

## Test 8: Meeting Format Poll
```
/poll create question:Preferred meeting format? options:In-person, Remote, Hybrid duration:720
```

## Test Commands to Run After Creating Polls:

### List All Active Polls
```
/poll list
```

### Test Results (use poll IDs from the list above)
```
/poll results poll_id:[INSERT_POLL_ID_HERE]
```

### Test Close Poll (use poll IDs from the list above)
```
/poll close poll_id:[INSERT_POLL_ID_HERE]
```

## Edge Case Tests:

### Test 9: Minimum Options
```
/poll create question:Simple choice? options:A, B
```

### Test 10: Maximum Options (10)
```
/poll create question:Pick a number? options:1, 2, 3, 4, 5, 6, 7, 8, 9, 10
```

### Test 11: Minimum Duration
```
/poll create question:Quick test? options:Fast, Slow duration:1
```

### Test 12: Maximum Duration (24 hours)
```
/poll create question:Long-term decision? options:Option A, Option B duration:1440
```

## Error Condition Tests:

### Test 13: Too Few Options (should fail)
```
/poll create question:Invalid poll? options:Only one option
```

### Test 14: Too Many Options (should fail)
```
/poll create question:Too many choices? options:1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12
```

### Test 15: Invalid Poll ID (should fail)
```
/poll results poll_id:nonexistent123
```

### Test 16: Close Non-existent Poll (should fail)
```
/poll close poll_id:fakeid999
```

## Expected Results:

1. **New Polls Should Show:**
   - Short 8-character poll ID (e.g., `abc123de`)
   - Initial vote counts at 0 (e.g., `1️⃣ 0  2️⃣ 0  3️⃣ 0`)
   - Professional embed design
   - Settings showing duration and choice limit
   - Automatic emoji reactions added

2. **Poll List Should Show:**
   - All active polls with short poll IDs
   - Time remaining for each poll
   - Legacy polls with message IDs (if any exist)

3. **Results Should Show:**
   - Vote counts with progress bars
   - Percentages
   - Total vote count
   - Poll status (Active/Ended)

4. **Close Should Show:**
   - Final results with winner highlighting
   - Poll marked as closed
   - No longer appears in active list

## Voting Test Instructions:

After creating polls:
1. Click the emoji reactions to vote
2. Try voting on multiple options (should only allow one per poll)
3. Check that vote counts update in real-time
4. Test with multiple users if possible

## Performance Tests:

- Create multiple polls quickly to test unique ID generation
- Test concurrent voting on the same poll
- Test polls with long questions and option names