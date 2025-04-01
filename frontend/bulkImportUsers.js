import { db } from "./src/firebaseConfig.js";  // Ensure this path is correct
import { collection, addDoc } from "firebase/firestore";

const classIDs = ["CSCE1040", "CSCE4905", "CSCE3055"];

// Function to generate users with correct formatting
const generateUsers = () => {
    let users = [];
    let idCounters = { S: 1001, T: 2001, A: 3001 };

    // Administrator
    users.push({
        fname: "Admin",
        lname: "User",
        email: `adminuser@administrator.com`,
        id: `A${idCounters.A++}`,
        role: "administrator",
    });

    // Teachers
    const teacherNames = [
        ["John", "Doe"],
        ["Emily", "Smith"],
        ["Michael", "Brown"]
    ];

    teacherNames.forEach(([fname, lname]) => {
        users.push({
            fname,
            lname,
            email: `${fname.toLowerCase()}${lname.toLowerCase()}@teacher.com`,
            id: `T${idCounters.T++}`,
            role: "teacher",
        });
    });

    // Students
    const studentNames = [
        ["Alice", "Johnson"], ["Bob", "Williams"], ["Charlie", "Taylor"],
        ["David", "Anderson"], ["Eve", "Thomas"], ["Frank", "Moore"],
        ["Grace", "Harris"], ["Hank", "Martin"], ["Ivy", "Thompson"],
        ["Jack", "White"], ["Kelly", "Clark"], ["Liam", "Lewis"]
    ];

    studentNames.forEach(([fname, lname]) => {
        users.push({
            fname,
            lname,
            email: `${fname.toLowerCase()}${lname.toLowerCase()}@student.com`,
            id: `S${idCounters.S++}`,
            role: "student",
            classes: getRandomClasses()
        });
    });

    return users;
};

// Function to randomly assign students to classes
const getRandomClasses = () => {
    let assignedClasses = new Set();
    let numClasses = Math.floor(Math.random() * 3) + 1; // 1 to 3 classes per student
    while (assignedClasses.size < numClasses) {
        assignedClasses.add(classIDs[Math.floor(Math.random() * classIDs.length)]);
    }
    return Array.from(assignedClasses);
};

const populateUsers = async () => {
    try {
        const usersRef = collection(db, "users");
        const users = generateUsers();

        for (const user of users) {
            await addDoc(usersRef, user);
            console.log(`Added user: ${user.fname} ${user.lname} (${user.id})`);
        }

        console.log("Users collection populated successfully.");
    } catch (error) {
        console.error("Error adding users:", error);
    }
};

// Run the function
populateUsers();
