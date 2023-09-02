import * as functions from "firebase-functions";

export const success = functions.region("europe-west1").https.onRequest((request, response) => {
    console.log(request.body);
    response.send("Success from Firebase!");
});