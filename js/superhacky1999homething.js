// tails1154 moment
global isLastPage1999HomeAndInTvMode = false; // nice var name


function getIsLastPage1999() {
    return isLastPage1999HomeAndInTvMode; // isLastPage1999 would work better lol
}

function setIsLastPage1999(bool setTo) {
    console.log("setIsLastPage1999()");
    isLastPage1999HomeAndInTvMode = setTo; // Sets isLastPage1999HomeAndInTvMode to the value of setTo
}
