const {CustomError} = require("../utils/utils")
const {Notes} = require("./../models/noteDetails")

// Validates note
let validateNote = async(req, res, next) => {
    let requiredFields = ["numbers", "note"]
    let note = req.body
    for(let reqField of requiredFields){
        if(!note.hasOwnProperty(reqField)){
            return res.json({
                message : "Didn't receive property " + reqField,
                code : 400
            })
        }
    }

    let numbers = note.numbers
    if(numbers.length != 2){
        return res.json({
            message : "Require only 2 numbers for a edge. Received " + numbers.length + " numbers",
            code : 400
        })
    }
    next()
}

// Adds note
let addNote =  async(req, res) => {
    let numbers = req.body.numbers
    let newNote = req.body.note
    
    try{
        // Sorting the numbers so that the lexicographically smaller number is srcNumber always
        numbers.sort()
        
        // Checking if existing notes exist
        let note = await Notes.findOne({srcNumber : numbers[0], destNumber : numbers[1]})
        
        if(!note){
            // Creating a new entry in note table with newNotes as the only note
            note = new Notes({
                srcNumber : numbers[0],
                destNumber : numbers[1],
                notes : [newNote]
            })
        }else{
            // Adding new note to existing notes
            let aggregatedNotes = note.notes
            aggregatedNotes.push(newNote)
            note.notes = aggregatedNotes
        }

        await note.save()
        return res.json({
            message : "Added note successfully",
            code : 201
        })    
    }catch(err){
        return res.json({
            message : err,
            code : 500
        })
    }
}

// Deletes notes
// let deleteNote = async(req, res) => {

// }

// Returns all notes
let getAllNotes = async(req, res) => {
    let notes = await Notes.find({})
    return res.json({
        message : notes,
        code : 200
    })
}

// Returns notes between callerNumber and calledNumber
let getEdgeNotes = async(req, res) => {
    let numbers = req.body.numbers
    if(!numbers){
        return res.json({
            message : "No numbers received for fetching notes",
            code : 400
        })
    }else if(numbers.length != 2){
        return res.json({
            message : "Only notes between 2 numbers can be found. Received " + numbers.length + " numbers",
            code : 400
        })
    }

    // Sorting the numbers so that the lexicographically smaller number is first always
    numbers.sort()    
    let notes = await Notes.findOne({srcNumber : numbers[0], destNumber : numbers[1]})
    return res.json({
        message : notes,
        code : 200
    })
}

// Delete a specific note by ID
let deleteNoteById = async(req, res) => {
    try {
        const noteId = req.params.id
        
        if (!noteId) {
            return res.status(400).json({
                message: "Note ID is required",
                code: 400
            })
        }

        const result = await Notes.findByIdAndDelete(noteId)
        
        if (!result) {
            return res.status(404).json({
                message: "Note not found",
                code: 404
            })
        }

        return res.json({
            message: "Note deleted successfully",
            deletedNote: result,
            code: 200
        })
    } catch (err) {
        console.error('Error deleting note:', err)
        return res.status(500).json({
            message: "Error deleting note",
            error: err.message,
            code: 500
        })
    }
}

// Delete a specific sub-note from notes array
let deleteSubNote = async(req, res) => {
    try {
        const { srcNumber, destNumber, noteIndex } = req.body
        
        if (!srcNumber || !destNumber || noteIndex === undefined) {
            return res.status(400).json({
                message: "srcNumber, destNumber, and noteIndex are required",
                code: 400
            })
        }

        // Sorting the numbers for consistent lookup
        let numbers = [srcNumber, destNumber].sort()
        
        const noteDoc = await Notes.findOne({srcNumber: numbers[0], destNumber: numbers[1]})
        
        if (!noteDoc) {
            return res.status(404).json({
                message: "Note not found",
                code: 404
            })
        }

        if (noteIndex < 0 || noteIndex >= noteDoc.notes.length) {
            return res.status(400).json({
                message: "Invalid note index",
                code: 400
            })
        }

        // Remove the note at the specified index
        noteDoc.notes.splice(noteIndex, 1)
        
        // If no notes left, delete the entire document
        if (noteDoc.notes.length === 0) {
            await Notes.findByIdAndDelete(noteDoc._id)
            return res.json({
                message: "Last note deleted, note document removed",
                code: 200
            })
        }

        await noteDoc.save()
        
        return res.json({
            message: "Sub-note deleted successfully",
            remainingNotes: noteDoc.notes,
            code: 200
        })
    } catch (err) {
        console.error('Error deleting sub-note:', err)
        return res.status(500).json({
            message: "Error deleting sub-note",
            error: err.message,
            code: 500
        })
    }
}

module.exports = {
    getAllNotes : getAllNotes, 
    getEdgeNotes : getEdgeNotes,
    addNote : addNote,
    validateNote : validateNote,
    deleteNoteById : deleteNoteById,
    deleteSubNote : deleteSubNote
}
