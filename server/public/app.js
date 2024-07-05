const socket =  io('ws://localhost:3500')


const activity = document.querySelector('.activity')
const msgInput = document.querySelector('input')


function sendMessage(e) {
    e.preventDefault();  // after submitting msg dont want to reload
    if(msgInput.value) {
        socket.emit('message' , msgInput.value)
        msgInput.value = ''
    }
    msgInput.focus()
}

document.querySelector('form').addEventListener('submit', sendMessage)

//Listen for Messages

socket.on('message', (data) => {
    const li = document.createElement('li')
    li.textContent = data
    document.querySelector('ul').appendChild(li)
})

msgInput.addEventListener('keypress', (e) => {
    socket.emit('activity', socket.id.substring(0, 5))

})

socket.on("activity", (name) => {
    activity.textContent = `${name} is typing...` 
})