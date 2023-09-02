import * as functions from "firebase-functions";

export const helloWorld = functions.region("europe-west1").https.onRequest((request, response) => {
    console.log("Hello logs!");
    response.send("Hello from Firebase!");
}); 