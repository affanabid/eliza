import { schedulePostAction } from './actions/schedule-post';
import dotenv from 'dotenv';
import * as readline from 'readline';

// Load environment variables
dotenv.config();

// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Promisify readline question
const question = (query: string): Promise<string> => {
    return new Promise((resolve) => {
        rl.question(query, resolve);
    });
};

// Validate date time format
function isValidDateTime(dateTimeStr: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
    if (!regex.test(dateTimeStr)) return false;
    
    const date = new Date(dateTimeStr.replace(' ', 'T'));
    return date instanceof Date && !isNaN(date.getTime());
}

async function testSchedulePost() {
    try {
        console.log('\nSchedule a Tweet');
        console.log('----------------');
        console.log('Please enter the date and time for the tweet to be posted.');
        console.log('Format: YYYY-MM-DD HH:mm (24-hour format)');
        console.log('Example: 2024-02-05 15:30');
        
        let scheduledDateTime: string;
        let isValid = false;

        do {
            scheduledDateTime = await question('\nEnter date and time: ');
            
            if (!isValidDateTime(scheduledDateTime)) {
                console.log('Invalid format! Please use YYYY-MM-DD HH:mm format.');
                continue;
            }

            const scheduleTime = new Date(scheduledDateTime.replace(' ', 'T'));
            const currentTime = new Date();

            if (scheduleTime <= currentTime) {
                console.log('Error: Scheduled time must be in the future!');
                continue;
            }

            isValid = true;

        } while (!isValid);

        const scheduleTime = new Date(scheduledDateTime.replace(' ', 'T'));
        console.log(`\nCurrent time: ${new Date().toLocaleString()}`);
        console.log(`Scheduling tweet for: ${scheduleTime.toLocaleString()}`);

        // Execute the action
        const result = await schedulePostAction.execute({
            parameters: {
                time: scheduleTime.toISOString()
            },
            runtime: {
                agentId: '00000000-0000-0000-0000-000000000000'
            }
        });

        console.log('\nSchedule result:', result);

        // Calculate wait time (add 30 seconds buffer)
        const waitTime = scheduleTime.getTime() - Date.now() + (30 * 1000);
        
        // Keep the process running
        console.log('\nWaiting for scheduled time...');
        console.log('(The program will exit 30 seconds after posting)');
        
        // Wait until scheduled time plus buffer
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        rl.close();
    }
}

// Run the test
testSchedulePost(); 
