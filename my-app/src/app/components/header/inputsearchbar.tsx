import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";

export function InputSearchBar() {
    return (
     <div className='input-search-bar'>
        <div className="search-logo">
            <FontAwesomeIcon icon={faMagnifyingGlass} />
        </div>
        <p>Search For</p>
    </div>
    )
}