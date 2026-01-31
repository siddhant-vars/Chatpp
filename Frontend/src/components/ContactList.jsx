import { useEffect } from "react"
import { useChatStore } from "../store/useChatStore.js"
import UsersLoadingSkeleton from "../components/UsersLoadingSkeleton.jsx"
import { useAuthStore } from "../store/useAuthStore.js"

function ContactList() {
  const {allContacts, getAllContacts, isUserLoading, setSelectedUser} = useChatStore()
  const {onlineUsers} = useAuthStore()
  useEffect(() => {
    getAllContacts()
  },[getAllContacts])
  if(isUserLoading) return <UsersLoadingSkeleton/>
  return (
    <>
    {allContacts.map((contact) => (
      <div key={contact._id}
      className="bg-cyan-500/10 p-4 rounded-lg cursor-pointer hover:bg-cyan-500/20 transition-colors"
      onClick={() => setSelectedUser(contact)}
      >
        <div className="flex items-center gap-3">
          <div className={`avatar ${onlineUsers.includes(contact._id)? "online": "offline"}`}>
            <div className="size-12 rounded-full">
              <img src={contact.profilePic || "/avatar.png"} alt={contact.fullname} />
            </div>
          </div>
          <h4 className="text-slate-200 font-medium truncate">{contact.fullname}</h4>
        </div>
      </div>
    ))}
    </>
  )
}

export default ContactList
